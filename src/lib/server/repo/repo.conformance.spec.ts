import { describe, expect, it } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
import { SCHEMA_DDL } from '$lib/server/db/duckdbSchema';
import type { MissedHour } from '$lib/types/missedHours';
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
      // `:memory:` — a real DuckDB engine running the real `SCHEMA_DDL`, but with
      // no file to create, lock, or clean up. Each test gets a fresh database.
      const connection = await (await DuckDBInstance.create(':memory:')).connect();
      await connection.run(SCHEMA_DDL);
      return createDuckDbMissedHourRepo(connection);
    },
  },
];

/** Fixed timestamps so nothing here depends on when the suite runs. */
const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

let uuidCounter = 0;
function report(overrides: Partial<MissedHour> = {}): MissedHour {
  uuidCounter += 1;

  return {
    uuid: `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`,
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

  it('round-trips a report unchanged', async () => {
    const repo = await create();
    const stored = report();

    await repo.add(stored);

    expect(await repo.list()).toEqual([stored]);
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
});
