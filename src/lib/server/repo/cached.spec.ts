import { describe, expect, it, vi } from 'vitest';
import type { MissedHourStats, NewMissedHour } from '$lib/types/missedHours';
import type { MissedHourRepo } from './types';
import { withCache } from './cached';

/** One report to write; the fake ignores every field, so any valid one will do. */
const REPORT: NewMissedHour = {
  schoolId: '0761322Z',
  class: '1ere',
  classGroup: null,
  discipline: 'maths',
  date_: '2026-08-17',
  nbHours: 2,
  createdAt: '2026-08-18T09:00:00.000Z',
  departement: '76',
};

const STATS: MissedHourStats = {
  total_hours: 12,
  total_hours_last_7d: 3,
  schools_affected: 2,
  classes_affected: 4,
};

/**
 * A repo that records what it was asked, and can be held open.
 *
 * The assertions below are all about *how often storage is reached*, so what the
 * fake answers barely matters — `calls` is the subject. `hold()` freezes `list()`
 * mid-flight, which is the only way to test what a cache does about a read and a
 * write racing each other.
 */
function createFakeRepo() {
  const calls: string[] = [];
  let pending: PromiseWithResolvers<void> | null = null;
  let nextId = 1;

  const repo: MissedHourRepo = {
    async add() {
      calls.push('add');
      // Distinct ids, so a test can tell "the wrapper passed the store's answer
      // through" apart from "the wrapper made one up".
      return nextId++;
    },
    async list(limit) {
      calls.push(`list:${limit ?? 'all'}`);
      if (pending) await pending.promise;
      return [];
    },
    async stats() {
      calls.push('stats');
      return STATS;
    },
    async top({ departement, dimension, limit }) {
      calls.push(`top:${departement ?? 'all'}:${dimension}:${limit}`);
      return [];
    },
  };

  return {
    repo,
    calls,
    hold: () => (pending = Promise.withResolvers<void>()),
    release: () => {
      pending?.resolve();
      pending = null;
    },
  };
}

/** Quiet by default: only the tests that assert on the log line ask for it. */
const quiet = { log: () => {} };

describe('withCache', () => {
  it('answers a repeated read without reaching storage', async () => {
    const { repo, calls } = createFakeRepo();
    const cached = withCache(repo, quiet);

    expect(await cached.stats()).toEqual(STATS);
    expect(await cached.stats()).toEqual(STATS);

    expect(calls).toEqual(['stats']);
  });

  it('caches each set of arguments separately', async () => {
    const { repo, calls } = createFakeRepo();
    const cached = withCache(repo, quiet);

    await cached.list(5);
    await cached.list(10);
    await cached.list(5);
    await cached.top({ departement: null, dimension: 'departement', limit: 5 });
    await cached.top({ departement: '76', dimension: 'departement', limit: 5 });
    await cached.top({ departement: '76', dimension: 'discipline', limit: 5 });
    await cached.top({ departement: '76', dimension: 'discipline', limit: 5 });

    // The two repeats are the point: everything else differs in exactly one
    // argument, and a key that dropped any of them would serve one query's rows
    // as another's.
    expect(calls).toEqual([
      'list:5',
      'list:10',
      'top:all:departement:5',
      'top:76:departement:5',
      'top:76:discipline:5',
    ]);
  });

  it('invalidates every operation when a report is added', async () => {
    const { repo, calls } = createFakeRepo();
    const cached = withCache(repo, quiet);

    await cached.list(5);
    await cached.stats();
    await cached.top({ departement: null, dimension: 'departement', limit: 5 });
    calls.length = 0;

    await cached.add(REPORT);

    await cached.list(5);
    await cached.stats();
    await cached.top({ departement: null, dimension: 'departement', limit: 5 });

    // A new report moves the list, both totals and any ranking it belongs to, so
    // all three lanes have to be cold again.
    expect(calls).toEqual(['add', 'list:5', 'stats', 'top:all:departement:5']);
  });

  it('passes the store’s id back through, after invalidating', async () => {
    const { repo, calls } = createFakeRepo();
    const cached = withCache(repo, quiet);

    await cached.list(5);
    calls.length = 0;

    // The wrapper is a cache, not a store: the id belongs to whatever it wraps,
    // and swallowing it would leave the submission action with nothing to log.
    expect(await cached.add(REPORT)).toBe(1);
    expect(await cached.add(REPORT)).toBe(2);

    // And it is answered *after* the lanes are cold, not before — a caller that
    // acts on the id must not be able to read a list that predates the row.
    await cached.list(5);
    expect(calls).toEqual(['add', 'add', 'list:5']);
  });

  it('stops serving an entry once its ttl has passed', async () => {
    const { repo, calls } = createFakeRepo();
    const cached = withCache(repo, { ...quiet, ttl: 20 });

    await cached.stats();
    await cached.stats();
    await new Promise((resolve) => setTimeout(resolve, 40));
    await cached.stats();

    expect(calls).toEqual(['stats', 'stats']);
  });

  it('coalesces concurrent misses into one query', async () => {
    const { repo, calls, hold, release } = createFakeRepo();
    const cached = withCache(repo, quiet);

    hold();
    const reads = Promise.all([cached.list(5), cached.list(5), cached.list(5)]);
    release();

    expect(await reads).toEqual([[], [], []]);
    // Three visitors landing on a cold homepage at once is one database round
    // trip, not three — the reason reads go through `fetch` rather than a plain
    // get/set pair.
    expect(calls).toEqual(['list:5']);
  });

  it('does not cache a read that was already in flight when a write landed', async () => {
    const { repo, calls, hold, release } = createFakeRepo();
    const cached = withCache(repo, quiet);

    hold();
    const inFlight = cached.list(5);

    await cached.add(REPORT);

    release();
    await inFlight;
    calls.length = 0;

    // Those rows predate the report and answering the next five minutes with
    // them would hide it. Invalidating aborts the pending fetch, so the value it
    // resolves to is handed to its own caller and never stored.
    await cached.list(5);

    expect(calls).toEqual(['list:5']);
  });

  it('does not cache a failed load, and lets the next read retry', async () => {
    const calls: string[] = [];
    const repo = {
      ...createFakeRepo().repo,
      async stats() {
        calls.push('stats');
        if (calls.length === 1) throw new Error('connection terminated');
        return STATS;
      },
    } satisfies MissedHourRepo;
    const cached = withCache(repo, quiet);

    await expect(cached.stats()).rejects.toThrow('connection terminated');

    // The error reaches the loader — nothing here decides what a page does about
    // a dead database — but it must not become the answer for five minutes, and
    // it must not leave the key wedged as permanently in flight.
    expect(await cached.stats()).toEqual(STATS);
    expect(calls).toEqual(['stats', 'stats']);
  });

  it('accounts for every read in the log', async () => {
    const { repo, hold, release } = createFakeRepo();
    const log = vi.fn();
    const cached = withCache(repo, { log });

    hold();
    const reads = Promise.all([cached.list(5), cached.list(5)]);
    release();
    await reads;
    await cached.list(5);

    // One line per read, and the three words mean different things: `miss` is a
    // database round trip, `wait` is a read that joined one, `hit` is a read
    // that touched nothing. Counting them is what says whether the cache is
    // worth keeping.
    expect(log.mock.calls.flat()).toEqual([
      '[cache] wait list:5',
      expect.stringMatching(/^\[cache] miss list:5 \(\d+ms\)$/),
      '[cache] hit  list:5',
    ]);
  });
});
