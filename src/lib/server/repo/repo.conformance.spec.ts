import { describe, expect, it } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
import { migrateDuckDb } from '$lib/server/db/duckdbMigrate';
import type { NewMissedHour } from '$lib/types/missedHours';
import { createMemoryMissedHourRepo } from './memory';
import { createDuckDbMissedHourRepo } from './duckdb';
import { STATS_WINDOW_DAYS, type MissedHourRepo } from './types';

/**
 * One suite, every backend.
 *
 * `MissedHourRepo` exists so the app can swap storage engines without the code
 * above it noticing. That promise is only worth something if the implementations
 * actually behave the same — so rather than testing each one separately, the
 * contract is written once here and replayed against all of them. A backend that
 * disagrees fails the *shared* test, which is the bug you want to hear about.
 *
 * Postgres is deliberately absent: it needs a live server, which would make
 * `npm test` depend on Docker being up. DuckDB gives real SQL execution against
 * the real schema with nothing running, so it covers the same ground for free.
 * Adding a Postgres row here later is the obvious next step, guarded on
 * `DATABASE_URL`.
 */
const BACKENDS: { name: string; create: () => Promise<MissedHourRepo> }[] = [
  {
    name: 'memory',
    // 0s jitter: the artificial latency exists to keep the UI's loading states
    // honest, and would only make the suite slow.
    create: async () => createMemoryMissedHourRepo(0),
  },
  {
    name: 'duckdb',
    create: async () => {
      // `:memory:` — a real DuckDB engine, brought up by the real `migrations/`,
      // with no file to create, lock, or clean up. Each test gets a fresh
      // database, and the migrations are exercised on every run.
      const connection = await (await DuckDBInstance.create(':memory:')).connect();
      await migrateDuckDb(connection);
      return createDuckDbMissedHourRepo(connection);
    },
  },
];

/**
 * Offsets from the real clock, captured once so every row in a run shares an
 * origin.
 *
 * It is tempting to freeze this at a literal instant — an earlier version did,
 * on the reasoning that a fixed date makes the suite independent of when it
 * runs. It achieves the opposite. `stats()` counts its rolling window back from
 * *now*, in both backends (SQL `now()` here, `Date.now()` in `memory.ts`), so a
 * frozen fixture drifts out of that window as the calendar moves and the test
 * starts failing on a date nobody changed anything on.
 *
 * The offsets are what the assertions are really about — "a day old", "older
 * than the window" — so express them that way and they stay true forever. Every
 * other use here only needs relative order, which either choice would give.
 */
const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function report(overrides: Partial<NewMissedHour> = {}): NewMissedHour {
  return {
    schoolId: '0761322Z',
    class: '1ere',
    classGroup: 'C',
    discipline: 'maths',
    date_: '2026-08-17',
    nbHours: 2,
    createdAt: daysAgo(1),
    ...overrides,
  };
}

describe.each(BACKENDS)('MissedHourRepo contract: $name', ({ create }) => {
  it('returns an empty list and zeroed stats before anything is stored', async () => {
    const repo = await create();

    expect(await repo.list()).toEqual([]);
    // `sum()` is NULL over zero rows in SQL; the repo has to coalesce it to 0 or
    // the UI renders "null heures".
    expect(await repo.stats()).toEqual({
      total_hours: 0,
      total_hours_last_7d: 0,
      schools_affected: 0,
      classes_affected: 0,
    });
  });

  it('round-trips a report unchanged, plus the id the store assigned', async () => {
    const repo = await create();
    const stored = report();

    await repo.add(stored);

    // `expect.any(Number)` on the id, exact equality on everything else: which
    // number a backend hands out is its own business (Postgres and DuckDB share
    // a sequence definition, the memory repo counts), but *that* it hands out a
    // number, and that no other field is touched in transit, is the contract.
    expect(await repo.list()).toEqual([{ ...stored, id: expect.any(Number), corroborations: 1 }]);
  });

  it('assigns ids itself rather than taking one from the caller', async () => {
    const repo = await create();

    await repo.add(report({ createdAt: daysAgo(2) }));
    await repo.add(report({ createdAt: daysAgo(1) }));

    // Distinct, integral, and increasing with insertion order — the three
    // properties anything using the id as a key or a cursor relies on. Note the
    // list is newest-first, so the ids come back descending.
    const ids = (await repo.list()).map((r) => r.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(Number.isInteger)).toBe(true);
    expect(ids[0]).toBeGreaterThan(ids[1]);
  });

  it('keeps the optional fields as null rather than inventing a value', async () => {
    const repo = await create();

    await repo.add(report({ classGroup: null, discipline: null }));
    const [row] = await repo.list();

    expect(row.classGroup).toBeNull();
    expect(row.discipline).toBeNull();
  });

  it('lists newest first', async () => {
    const repo = await create();
    // Inserted oldest-first on purpose: an implementation that just returns rows
    // in insertion order would pass a test that inserted them the other way.
    await repo.add(report({ class: 'oldest', createdAt: daysAgo(3) }));
    await repo.add(report({ class: 'newest', createdAt: daysAgo(1) }));
    await repo.add(report({ class: 'middle', createdAt: daysAgo(2) }));

    expect((await repo.list()).map((r) => r.class)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('hands back `createdAt` as an ISO-8601 instant', async () => {
    const repo = await create();
    const createdAt = '2026-08-18T09:00:00.000Z';

    await repo.add(report({ createdAt }));
    const [row] = await repo.list();

    // Exact equality, not "parses to the same time": DuckDB's own text rendering
    // is `2026-08-18 11:00:00+02` — a space, a truncated offset, and the server's
    // local zone. This assertion is what pins that conversion down.
    expect(row.createdAt).toBe(createdAt);
  });

  describe('stats', () => {
    it('sums hours and counts distinct schools and classes', async () => {
      const repo = await create();

      await repo.add(report({ schoolId: 'A', class: '6e', nbHours: 2 }));
      await repo.add(report({ schoolId: 'A', class: '6e', nbHours: 3 }));
      await repo.add(report({ schoolId: 'B', class: '5e', nbHours: 1 }));

      const stats = await repo.stats();

      expect(stats.total_hours).toBe(6);
      // Distinct, not row count: two reports name school A and class 6e.
      expect(stats.schools_affected).toBe(2);
      expect(stats.classes_affected).toBe(2);
    });

    it('counts only the last 7 days in the rolling window', async () => {
      const repo = await create();

      await repo.add(report({ nbHours: 5, createdAt: daysAgo(1) }));
      await repo.add(report({ nbHours: 7, createdAt: daysAgo(STATS_WINDOW_DAYS + 1) }));

      const stats = await repo.stats();

      expect(stats.total_hours).toBe(12);
      expect(stats.total_hours_last_7d).toBe(5);
    });
  });

  /**
   * The number is the app's only evidence that an anonymous report is real, so
   * every rule about what counts as "the same missed hour" is pinned here rather
   * than in one backend's own suite — a SQL `partition by` and a JS `Map` key are
   * two very different ways to get this subtly wrong.
   */
  describe('corroborations', () => {
    it('is 1 for a report nobody else made', async () => {
      const repo = await create();

      await repo.add(report());

      expect((await repo.list())[0].corroborations).toBe(1);
    });

    it('counts every report describing the same hour', async () => {
      const repo = await create();

      // Identical in all six keyed fields — the same class and group, at the
      // same school, on the same day, losing the same two hours of maths.
      const hour = {
        schoolId: 'A',
        class: '6e',
        classGroup: 'B' as const,
        date_: '2026-08-17',
        discipline: 'maths' as const,
        nbHours: 2,
      };

      await repo.add(report(hour));
      await repo.add(report(hour));
      await repo.add(report(hour));

      // Every row carries the total, itself included — not "how many others".
      expect((await repo.list()).map((r) => r.corroborations)).toEqual([3, 3, 3]);
    });

    it.each([
      ['school', { schoolId: 'B' }],
      ['class', { class: '5e' }],
      ['date', { date_: '2026-08-18' }],
    ])('does not corroborate across a different %s', async (_field, difference) => {
      const repo = await create();

      await repo.add(report({ schoolId: 'A', class: '6e', date_: '2026-08-17' }));
      await repo.add(report({ schoolId: 'A', class: '6e', date_: '2026-08-17', ...difference }));

      expect((await repo.list()).map((r) => r.corroborations)).toEqual([1, 1]);
    });

    it.each([
      ['discipline', { discipline: 'hist-geo' as const }],
      ['hour count', { nbHours: 4 }],
      ['class group', { classGroup: 'D' as const }],
    ])('does not corroborate across a different %s', async (_field, difference) => {
      const repo = await create();

      // The key identifies one specific hour, not a day. A maths hour and a
      // history hour lost on the same morning are two different hours that
      // happen to share a date, and « 6e C » and « 6e D » are different rooms of
      // different pupils. Counting any of them together would report them as
      // corroborating each other when they do not.
      await repo.add(report({ discipline: 'maths', nbHours: 2, classGroup: 'C' }));
      await repo.add(report({ discipline: 'maths', nbHours: 2, classGroup: 'C', ...difference }));

      expect((await repo.list()).map((r) => r.corroborations)).toEqual([1, 1]);
    });

    it('corroborates two reports that both left the class group blank', async () => {
      const repo = await create();

      // Same null handling as the discipline: SQL `partition by` groups nulls
      // together, and the JSON-encoded key has to agree. The group is optional
      // on the form, so two blanks is a common shape.
      await repo.add(report({ classGroup: null }));
      await repo.add(report({ classGroup: null }));

      expect((await repo.list()).map((r) => r.corroborations)).toEqual([2, 2]);
    });

    it('keeps a report with no class group separate from one that named it', async () => {
      const repo = await create();

      await repo.add(report({ classGroup: null }));
      await repo.add(report({ classGroup: 'C' }));

      expect((await repo.list()).map((r) => r.corroborations)).toEqual([1, 1]);
    });

    it('counts over the whole table, not just the rows returned', async () => {
      const repo = await create();

      for (let i = 0; i < 4; i++) {
        await repo.add(report({ createdAt: daysAgo(i + 1) }));
      }

      // One row asked for, but it knows all four reports exist behind it. A
      // count computed after the limit would say 1 and quietly understate every
      // paged view in the app.
      const [row] = await repo.list(1);

      expect(row.corroborations).toBe(4);
    });

    it('keeps a report with no discipline separate from one that named a subject', async () => {
      const repo = await create();

      await repo.add(report({ discipline: null }));
      await repo.add(report({ discipline: 'maths' }));

      // "Subject not given" is not a claim that the subject was maths, so the
      // two are not evidence for each other. The discipline is optional on the
      // form, which makes this the most common way a count stays at 1.
      expect((await repo.list()).map((r) => r.corroborations)).toEqual([1, 1]);
    });

    it('corroborates two reports that both left the discipline blank', async () => {
      const repo = await create();

      await repo.add(report({ discipline: null, nbHours: 2 }));
      await repo.add(report({ discipline: null, nbHours: 2 }));

      // The half of null handling that is easy to get wrong in one backend and
      // not the other: SQL `partition by` groups nulls *together*, and the
      // JSON-encoded key has to agree.
      expect((await repo.list()).map((r) => r.corroborations)).toEqual([2, 2]);
    });
  });
});
