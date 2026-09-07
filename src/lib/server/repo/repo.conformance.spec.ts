import { describe, expect, it } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
import { migrateDuckDb } from '$lib/server/db/duckdbMigrate';
import type { NewMissedHour } from '$lib/types/missedHours';
import { createMemoryMissedHourRepo } from './memory';
import { createDuckDbMissedHourRepo } from './duckdb';
import { withCache } from './cached';
import { CORROBORATION_KEY, STATS_WINDOW_DAYS, type MissedHourRepo } from './types';

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
  {
    // Not a backend — the cache `src/lib/server/repo/index.ts` wraps the real one
    // in. It belongs here because its whole promise is that it changes nothing:
    // a `MissedHourRepo` that caches reads is still a `MissedHourRepo`, and the
    // contract below is the definition of that. `cached.spec.ts` tests the
    // caching; this row tests the *absence* of any other difference, which is
    // where an under-invalidating cache shows up — as a suite that passes for
    // every backend and fails for this one.
    name: 'cached memory',
    create: async () => withCache(createMemoryMissedHourRepo(0), { log: () => {} }),
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
    departement: '76',
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

  /**
   * The dashboard ranking. Every rule here is one a `group by` and a JS `Map`
   * can disagree about — ordering, tie-breaks, what a null means, and whether
   * "no département" means "all of them".
   */
  describe('top', () => {
    const inDept = (departement: string, overrides: Partial<NewMissedHour> = {}) =>
      report({ departement, ...overrides });

    it('returns nothing at all when there is nothing stored', async () => {
      const repo = await create();

      expect(await repo.top({ departement: '75', dimension: 'school', limit: 5 })).toEqual([]);
    });

    it('ranks schools by total hours, descending', async () => {
      const repo = await create();

      await repo.add(inDept('75', { schoolId: 'A', nbHours: 1 }));
      await repo.add(inDept('75', { schoolId: 'B', nbHours: 4 }));
      await repo.add(inDept('75', { schoolId: 'C', nbHours: 2 }));

      const top = await repo.top({ departement: '75', dimension: 'school', limit: 5 });

      expect(top).toEqual([
        { key: 'B', totalHours: 4, events: 1, submissions: 1 },
        { key: 'C', totalHours: 2, events: 1, submissions: 1 },
        { key: 'A', totalHours: 1, events: 1, submissions: 1 },
      ]);
    });

    it('sums hours and counts events within a group', async () => {
      const repo = await create();

      await repo.add(inDept('75', { schoolId: 'A', nbHours: 2, date_: '2026-08-17' }));
      await repo.add(inDept('75', { schoolId: 'A', nbHours: 3, date_: '2026-08-18' }));

      expect(await repo.top({ departement: '75', dimension: 'school', limit: 5 })).toEqual([
        { key: 'A', totalHours: 5, events: 2, submissions: 2 },
      ]);
    });

    it('ranks by hours rather than by number of reports', async () => {
      const repo = await create();

      // Three small reports against one large one. Ranking on `reportCount`
      // would put A first; the site measures lost teaching time, so B wins.
      await repo.add(inDept('75', { schoolId: 'A', nbHours: 1, date_: '2026-08-17' }));
      await repo.add(inDept('75', { schoolId: 'A', nbHours: 1, date_: '2026-08-18' }));
      await repo.add(inDept('75', { schoolId: 'A', nbHours: 1, date_: '2026-08-19' }));
      await repo.add(inDept('75', { schoolId: 'B', nbHours: 4 }));

      const [first] = await repo.top({ departement: '75', dimension: 'school', limit: 5 });

      expect(first).toEqual({ key: 'B', totalHours: 4, events: 1, submissions: 1 });
    });

    it('breaks ties on the key, so the order is stable across reloads', async () => {
      const repo = await create();

      await repo.add(inDept('75', { schoolId: 'B', nbHours: 2 }));
      await repo.add(inDept('75', { schoolId: 'A', nbHours: 2 }));

      expect(
        (await repo.top({ departement: '75', dimension: 'school', limit: 5 })).map((r) => r.key)
      ).toEqual(['A', 'B']);
    });

    it('honours the limit', async () => {
      const repo = await create();

      for (const [schoolId, nbHours] of [
        ['A', 1],
        ['B', 2],
        ['C', 3],
        ['D', 4],
      ] as const) {
        await repo.add(inDept('75', { schoolId, nbHours }));
      }

      const top = await repo.top({ departement: '75', dimension: 'school', limit: 2 });

      expect(top.map((r) => r.key)).toEqual(['D', 'C']);
    });

    it('counts only the département asked for', async () => {
      const repo = await create();

      await repo.add(inDept('75', { schoolId: 'A', nbHours: 1 }));
      await repo.add(inDept('2A', { schoolId: 'B', nbHours: 9 }));

      expect(await repo.top({ departement: '75', dimension: 'school', limit: 5 })).toEqual([
        { key: 'A', totalHours: 1, events: 1, submissions: 1 },
      ]);
    });

    it('counts every département when asked for none', async () => {
      const repo = await create();

      await repo.add(inDept('75', { schoolId: 'A', nbHours: 1 }));
      await repo.add(inDept('2A', { schoolId: 'B', nbHours: 9 }));
      // Including rows with no département at all — a national total that
      // silently dropped them would be wrong, and `departement is null` is
      // exactly the mistake this catches.
      await repo.add(report({ departement: null, schoolId: 'C', nbHours: 5 }));

      expect(
        (await repo.top({ departement: null, dimension: 'school', limit: 5 })).map((r) => r.key)
      ).toEqual(['B', 'C', 'A']);
    });

    it('excludes rows with no département from a département-scoped ranking', async () => {
      const repo = await create();

      await repo.add(report({ departement: null, schoolId: 'A', nbHours: 9 }));

      expect(await repo.top({ departement: '75', dimension: 'school', limit: 5 })).toEqual([]);
    });

    it('ranks disciplines when asked for that dimension', async () => {
      const repo = await create();

      await repo.add(inDept('75', { discipline: 'maths', nbHours: 1, schoolId: 'A' }));
      await repo.add(inDept('75', { discipline: 'sport', nbHours: 6, schoolId: 'B' }));

      expect(await repo.top({ departement: '75', dimension: 'discipline', limit: 5 })).toEqual([
        { key: 'sport', totalHours: 6, events: 1, submissions: 1 },
        { key: 'maths', totalHours: 1, events: 1, submissions: 1 },
      ]);
    });

    it('leaves reports that named no discipline out of the discipline ranking', async () => {
      const repo = await create();

      await repo.add(inDept('75', { discipline: null, nbHours: 99, schoolId: 'A' }));
      await repo.add(inDept('75', { discipline: 'maths', nbHours: 1, schoolId: 'B' }));

      // A "non précisé" row would top this ranking while naming no subject —
      // and the discipline is optional on the form, so it would be a common
      // outcome, not an edge case.
      expect(await repo.top({ departement: '75', dimension: 'discipline', limit: 5 })).toEqual([
        { key: 'maths', totalHours: 1, events: 1, submissions: 1 },
      ]);
    });
  });

  /**
   * The point of `missed_hour_event` (migration 007): five people reporting one
   * cancelled maths hour is one hour of lost teaching, not five.
   *
   * Every assertion here runs against both backends, because a SQL `group by`
   * and a JS `Map` are two very different ways to get this wrong — and if they
   * ever disagree, the site's headline numbers are the thing that silently
   * breaks.
   */
  describe('deduplication of corroborated reports', () => {
    /** The same hour, described identically. */
    const hour = {
      schoolId: 'A',
      class: '6e',
      classGroup: 'B' as const,
      date_: '2026-08-17',
      discipline: 'maths' as const,
      nbHours: 2,
      departement: '75',
    };

    it('counts a corroborated hour once in the totals', async () => {
      const repo = await create();

      await repo.add(report({ ...hour, createdAt: daysAgo(3) }));
      await repo.add(report({ ...hour, createdAt: daysAgo(2) }));
      await repo.add(report({ ...hour, createdAt: daysAgo(1) }));

      const stats = await repo.stats();

      // Three submissions, one two-hour event. The old behaviour said 6.
      expect(stats.total_hours).toBe(2);
      expect(stats.total_hours_last_7d).toBe(2);
    });

    it('still adds up genuinely distinct hours', async () => {
      const repo = await create();

      // Same class and day, different subjects: two different hours, not
      // corroboration. Deduplicating must not swallow these.
      await repo.add(report({ ...hour, discipline: 'maths', nbHours: 2 }));
      await repo.add(report({ ...hour, discipline: 'sport', nbHours: 1 }));

      expect((await repo.stats()).total_hours).toBe(3);
    });

    it('measures the rolling window from the first report, not the latest', async () => {
      const repo = await create();

      // First described well outside the window, corroborated yesterday. The
      // event is old; a fresh corroboration must not drag it back into "this
      // week" and read as new activity.
      await repo.add(report({ ...hour, createdAt: daysAgo(STATS_WINDOW_DAYS + 3) }));
      await repo.add(report({ ...hour, createdAt: daysAgo(1) }));

      const stats = await repo.stats();

      expect(stats.total_hours).toBe(2);
      expect(stats.total_hours_last_7d).toBe(0);
    });

    it('ranks on hours lost, so corroboration cannot inflate a school', async () => {
      const repo = await create();

      // School A: one hour, reported by four people. School B: three genuinely
      // different hours. B has lost more teaching and must rank first.
      for (const n of [4, 3, 2, 1]) {
        await repo.add(report({ ...hour, schoolId: 'A', nbHours: 2, createdAt: daysAgo(n) }));
      }
      await repo.add(report({ ...hour, schoolId: 'B', discipline: 'maths', nbHours: 1 }));
      await repo.add(report({ ...hour, schoolId: 'B', discipline: 'sport', nbHours: 1 }));
      await repo.add(report({ ...hour, schoolId: 'B', discipline: 'svt', nbHours: 1 }));

      const top = await repo.top({ departement: '75', dimension: 'school', limit: 5 });

      expect(top).toEqual([
        { key: 'B', totalHours: 3, events: 3, submissions: 3 },
        { key: 'A', totalHours: 2, events: 1, submissions: 4 },
      ]);
    });

    it('keeps the submissions visible without letting them into the ranking', async () => {
      const repo = await create();

      await repo.add(report({ ...hour, createdAt: daysAgo(2) }));
      await repo.add(report({ ...hour, createdAt: daysAgo(1) }));

      const [entry] = await repo.top({ departement: '75', dimension: 'school', limit: 5 });

      expect(entry.events).toBe(1);
      expect(entry.submissions).toBe(2);
      expect(entry.totalHours).toBe(2);
    });

    it.each(CORROBORATION_KEY)(
      'treats reports differing in %s as separate hours',
      async (field) => {
        const repo = await create();

        // The drift guard. Every field of `CORROBORATION_KEY` must split an
        // event in *both* backends — if the view's `group by` and this constant
        // ever fall out of step, the totals go wrong silently, and this is
        // where that shows up.
        const different: Record<string, unknown> = {
          schoolId: 'OTHER',
          class: '5e',
          classGroup: 'F',
          date_: '2026-08-18',
          discipline: 'sport',
          nbHours: 4,
        };

        await repo.add(report(hour));
        await repo.add(report({ ...hour, [field]: different[field] }));

        const stats = await repo.stats();

        // Two events, so the hours add up rather than collapsing.
        expect(stats.total_hours).toBe(2 + (field === 'nbHours' ? 4 : 2));
      }
    );

    it('does not split an event when only the département differs', async () => {
      const repo = await create();

      // `departement` is aggregated by the view rather than grouped, precisely
      // so a row written before `006` (null) and one written after ('75') stay
      // one event. Grouping on it would double-count the rows this view exists
      // to combine.
      await repo.add(report({ ...hour, departement: null, createdAt: daysAgo(2) }));
      await repo.add(report({ ...hour, departement: '75', createdAt: daysAgo(1) }));

      expect((await repo.stats()).total_hours).toBe(2);
      // And the surviving département is the non-null one, so the event still
      // appears in that département's ranking.
      const top = await repo.top({ departement: '75', dimension: 'school', limit: 5 });
      expect(top).toEqual([{ key: 'A', totalHours: 2, events: 1, submissions: 2 }]);
    });
  });
});
