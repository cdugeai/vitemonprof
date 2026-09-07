import type { MissedHour, MissedHourStats, NewMissedHour } from '$lib/types/missedHours';
import { CORROBORATION_KEY, STATS_WINDOW_DAYS, type MissedHourRepo } from './types';

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
  // Stored without `corroborations`: it is derived on read, exactly as it is in
  // the SQL backends, so there is no denormalised copy here to fall out of date.
  const rows: (NewMissedHour & { id: number })[] = [];

  // The stand-in for `missed_hour_id_seq`. Counting rows instead would be wrong
  // the moment a delete exists — a sequence never reissues a number, and the
  // conformance suite holds every backend to the same promise.
  let nextId = 1;

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const jitter = () => delay(Math.random() * maxWaitTimeS * 1000);

  return {
    async add(mh) {
      await jitter();
      rows.push({ ...mh, id: nextId });
      nextId += 1;
    },

    async list(limit?: number) {
      await jitter();

      // Counted over every row, before the limit — the SQL backends compute the
      // window function over the whole table too, so a limited page still reports
      // the true number of reports behind each row.
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = corroborationKeyOf(row);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      // Copy before sorting: `toSorted` would also work, but an explicit copy makes
      // it obvious we're not reordering the stored array under other callers.
      const sorted = [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const page = limit !== undefined ? sorted.slice(0, limit) : sorted;

      return page.map(
        (row) =>
          ({
            ...row,
            corroborations: counts.get(corroborationKeyOf(row)) ?? 1,
          }) satisfies MissedHour
      );
    },

    async stats() {
      await jitter();

      // Same rolling window as the SQL backend: the last 7 * 24h counted back from
      // now, not calendar days.
      const cutoffMs = Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const isInWindow = (m: NewMissedHour) => Date.parse(m.createdAt) >= cutoffMs;
      const sumHours = (ms: NewMissedHour[]) => ms.reduce((total, m) => total + m.nbHours, 0);

      return {
        total_hours: sumHours(rows),
        total_hours_last_7d: sumHours(rows.filter(isInWindow)),
        classes_affected: new Set(rows.map((m) => m.class)).size,
        schools_affected: new Set(rows.map((m) => m.schoolId)).size,
      } satisfies MissedHourStats;
    },
  };
}

/**
 * The in-memory stand-in for `partition by school_id, class, date`.
 *
 * `JSON.stringify` of the key fields rather than a template string: a school id
 * containing the separator would otherwise let two different events collide into
 * one key, and JSON quotes and escapes each part for us.
 */
function corroborationKeyOf(row: NewMissedHour): string {
  return JSON.stringify(CORROBORATION_KEY.map((field) => row[field]));
}
