import type { MissedHour, MissedHourStats } from '$lib/types/missedHours';

/**
 * The storage port for missed-hour reports.
 *
 * This interface — not Drizzle — is the app's portability boundary. Drizzle looks
 * swappable but isn't: `pgTable` / `sqliteTable` / … are different APIs with
 * different types, so changing engine underneath it still rewrites the data layer.
 * Keeping the contract in domain terms (`MissedHour`, `MissedHourStats` — plain
 * strings and numbers, no driver types) means an engine swap touches exactly one
 * implementation file and nothing above it.
 *
 * The rule that keeps this honest: **no engine type may cross this boundary**. No
 * Drizzle row types, no `Date` objects out of the driver, no `numeric` strings.
 * The implementation maps to the domain shape; callers stay ignorant of storage.
 */
export interface MissedHourRepo {
  /** Persist one report. `uuid` is supplied by the caller, not the store. */
  add(mh: MissedHour): Promise<void>;

  /**
   * All reports, **newest first** (`createdAt` descending).
   *
   * The order is part of the contract, not an accident of the implementation:
   * `RecentReports.svelte` takes `.slice(0, 5)` and labels them "récents", so an
   * insertion-ordered result would show the five *oldest* reports once there are
   * more than five.
   */
  list(): Promise<MissedHour[]>;

  /**
   * Aggregates for the stats panel.
   *
   * Separate from `list()` on purpose: this is the one operation that should be
   * pushed down into the engine rather than computed after fetching every row.
   * Each backend is free to implement it its own way — that divergence is the
   * point of the interface, not a leak in it.
   */
  stats(): Promise<MissedHourStats>;
}

/** Rolling window for the "last 7 days" stat, shared so backends can't disagree. */
export const STATS_WINDOW_DAYS = 7;
