import { LRUCache } from 'lru-cache';
import type { MissedHour, MissedHourStats, TopMissedHours } from '$lib/types/missedHours';
import type { MissedHourRepo, TopQuery } from './types';

/**
 * How long a cached answer may be served. Five minutes is an *upper bound on
 * staleness*, not a refresh interval: a write invalidates immediately, so the TTL
 * only governs how long a read can lag a change this process did not make — an
 * insert on another node, or a row written by hand.
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Entries per lane. The homepage needs two (`list:5` and `stats`); a ranking
 * exists per département × dimension asked for, and there are 101 départements.
 * This is a memory bound rather than a tuning knob — an entry is a handful of
 * rows.
 */
export const CACHE_MAX_ENTRIES = 250;

export interface CacheOptions {
  /** Overrides {@link CACHE_TTL_MS}. Tests use a few milliseconds. */
  ttl?: number;
  /** Overrides {@link CACHE_MAX_ENTRIES}. */
  max?: number;
  /** Where the hit/miss line goes. Tests pass a spy, or a no-op to stay quiet. */
  log?: (message: string) => void;
}

/**
 * A read-through cache in front of any `MissedHourRepo`.
 *
 * It is a **decorator over the port**, not caching bolted onto each backend or
 * onto each loader. That placement is what makes it one file instead of five:
 * every backend inherits it, both loaders benefit without knowing, and — the part
 * that matters — `add()` is the only write in the interface, so invalidation has
 * exactly one site and no caller can forget it.
 *
 * The cache is **per process**. Scale to several nodes and each keeps its own; a
 * report accepted by node A stays invisible to node B's cache until its entries
 * age out. That is the trade the issue asks for deliberately: sharing one would
 * mean running a Redis for a public dashboard where minutes of lag cost nothing.
 */
export function withCache(repo: MissedHourRepo, options: CacheOptions = {}): MissedHourRepo {
  // One lane per operation rather than one cache keyed by a prefix. Two reasons,
  // and the second is the real one: each lane is typed with the values it holds,
  // so nothing needs an `as` on the way out — and the dashboard's key churn (a
  // lane that grows with every département anyone browses) cannot evict the
  // homepage's two entries, which a shared `max` would eventually let it do.
  const lists = createLane<MissedHour[]>(options);
  const stats = createLane<MissedHourStats>(options);
  const tops = createLane<TopMissedHours[]>(options);
  const lanes = [lists, stats, tops];

  return {
    async add(mh) {
      const id = await repo.add(mh);

      // Everything, not just the list: one report moves the totals, the rolling
      // window, and any ranking its school or discipline appears in. Narrower
      // invalidation would mean re-deriving in JS which rankings a row lands in
      // — the exact reasoning the SQL owns — to save re-running two queries.
      for (const lane of lanes) lane.invalidate();

      // Invalidate first, answer second. The id is the wrapped store's, and
      // returning it early would let a caller act on a row the cache still
      // denies exists.
      return id;
    },

    list: (limit) => lists.get(`list:${limit ?? 'all'}`, () => repo.list(limit)),

    stats: () => stats.get('stats', () => repo.stats()),

    top: (query) => tops.get(topKey(query), () => repo.top(query)),
  };
}

/**
 * The cache key for a ranking.
 *
 * Joined with `:` and not escaped because both parts are closed sets validated
 * upstream — `isDepartement` in the dashboard loader, and a `TopDimension` union
 * — so neither can contain the separator and collide two different queries into
 * one entry. `all` rather than an empty segment for the whole country, so the key
 * stays readable in the log line.
 */
function topKey({ departement, dimension, limit }: TopQuery): string {
  return `top:${departement ?? 'all'}:${dimension}:${limit}`;
}

interface Lane<T extends NonNullable<unknown>> {
  get(key: string, load: () => Promise<T>): Promise<T>;
  invalidate(): void;
}

/**
 * One operation's cache: an LRU with a TTL, plus the two things a bare
 * `get`/`set` pair gets wrong under concurrency.
 *
 * lru-cache's own `fetch()` does both of these, and this deliberately does not
 * use it: `clear()` aborts a pending `fetch`, and an aborted `fetch` **rejects**
 * with `Error('deleted')`. A visitor whose page load happened to overlap someone
 * else's submission would get a 500 for it. Fifteen lines of explicit
 * bookkeeping is the cheaper answer, and it says what it does.
 */
function createLane<T extends NonNullable<unknown>>({
  ttl = CACHE_TTL_MS,
  max = CACHE_MAX_ENTRIES,
  log = console.log,
}: CacheOptions): Lane<T> {
  // `updateAgeOnGet` stays off on purpose: refreshing the TTL on every read would
  // let a hot key — and `list:5` is read on every visit to the homepage — never
  // expire at all, which is the one thing the five minutes is there to prevent.
  const cache = new LRUCache<string, T>({ ttl, max });

  /** Loads in flight, so that N concurrent misses make one query, not N. */
  const inFlight = new Map<string, Promise<T>>();

  /**
   * Bumped by every invalidation.
   *
   * A load that started before a write and lands after it holds pre-write rows,
   * and storing those would hide the new report for the whole TTL — including
   * from the person who just filed it. Comparing the generation at the end
   * against the one at the start is how such a result is still returned to the
   * caller that asked for it, and still not allowed to become the next five
   * minutes of answers.
   */
  let generation = 0;

  return {
    async get(key, load) {
      const cached = cache.get(key);

      if (cached !== undefined) {
        log(`[cache] hit  ${key}`);
        return cached;
      }

      // Someone else is already asking storage this exact question. Wait on
      // their answer rather than opening a second connection to get the same
      // rows — the thundering herd right after an invalidation is the case this
      // is for, since a submission empties the cache and the submitter's own
      // reload arrives immediately after it.
      const pending = inFlight.get(key);

      if (pending) {
        log(`[cache] wait ${key}`);
        return pending;
      }

      const startedAt = performance.now();
      const startedIn = generation;

      const load_ = load()
        .then((value) => {
          if (generation === startedIn) cache.set(key, value);
          return value;
        })
        .finally(() => {
          // Guarded because `invalidate()` may already have dropped this entry
          // and a newer load may have taken the key: deleting unconditionally
          // would evict that one and send the next request to storage.
          if (inFlight.get(key) === load_) inFlight.delete(key);
        });

      inFlight.set(key, load_);

      const value = await load_;
      log(`[cache] miss ${key} (${Math.round(performance.now() - startedAt)}ms)`);

      return value;
    },

    invalidate() {
      generation += 1;
      cache.clear();
      // Dropped as well as the stored entries, so a request arriving after the
      // write starts its own load instead of joining one that predates it.
      // Callers already awaiting hold the promise itself and are unaffected.
      inFlight.clear();
    },
  };
}
