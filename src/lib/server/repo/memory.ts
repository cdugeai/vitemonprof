import type { MissedHour, MissedHourStats } from '$lib/types/missedHours';
import { STATS_WINDOW_DAYS, type MissedHourRepo } from './types';

/**
 * In-process implementation, backed by an array. Data lives as long as the server
 * process does — fine for tests and for developing UI without Docker running,
 * useless for anything else.
 *
 * The artificial latency is deliberate: it keeps the loading states in
 * `+page.svelte` (the `{#await}` blocks) honest. A store that resolves
 * synchronously makes spinners look dead and hides ordering bugs.
 */
export function createMemoryMissedHourRepo(maxWaitTimeS = 3): MissedHourRepo {
  const rows: MissedHour[] = [];

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const jitter = () => delay(Math.random() * maxWaitTimeS * 1000);

  return {
    async add(mh) {
      await jitter();
      rows.push(mh);
    },

    async list() {
      await jitter();

      // Copy before sorting: `toSorted` would also work, but an explicit copy makes
      // it obvious we're not reordering the stored array under other callers.
      return [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },

    async stats() {
      await jitter();

      // Same rolling window as the SQL backend: the last 7 * 24h counted back from
      // now, not calendar days.
      const cutoffMs = Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const isInWindow = (m: MissedHour) => Date.parse(m.createdAt) >= cutoffMs;
      const sumHours = (ms: MissedHour[]) => ms.reduce((total, m) => total + m.nbHours, 0);

      return {
        total_hours: sumHours(rows),
        total_hours_last_7d: sumHours(rows.filter(isInWindow)),
        classes_affected: new Set(rows.map((m) => m.class)).size,
        schools_affected: new Set(rows.map((m) => m.schoolId)).size,
      } satisfies MissedHourStats;
    },
  };
}
