import type {
  MissedHour,
  MissedHourStats,
  NewMissedHour,
  TopMissedHours,
} from '$lib/types/missedHours';
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

      // Over *events*, not rows — the in-memory equivalent of the SQL backends
      // reading `missed_hour_event`. Summing the raw rows would count a
      // corroborated hour once per reporter.
      const events = eventsOf(rows);

      // Same rolling window as the SQL backend: the last 7 * 24h counted back from
      // now, not calendar days. Measured from when the event was *first*
      // reported, so a fresh corroboration cannot drag an old event back into
      // this week.
      const cutoffMs = Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const isInWindow = (e: MissedHourEvent) => Date.parse(e.firstReportedAt) >= cutoffMs;
      const sumHours = (es: MissedHourEvent[]) => es.reduce((total, e) => total + e.nbHours, 0);

      return {
        total_hours: sumHours(events),
        total_hours_last_7d: sumHours(events.filter(isInWindow)),
        // Distinct already, so grouping changes nothing — but they are computed
        // from the same events as the sums, so all four numbers describe one
        // view of the data.
        classes_affected: new Set(events.map((e) => e.class)).size,
        schools_affected: new Set(events.map((e) => e.schoolId)).size,
      } satisfies MissedHourStats;
    },

    async top({ departement, dimension, limit }) {
      await jitter();

      const totals = new Map<string, TopMissedHours>();

      for (const event of eventsOf(rows)) {
        if (departement !== null && event.departement !== departement) continue;

        // The `null` case is the discipline nobody named. Skipped rather than
        // bucketed, exactly as the SQL's `is not null` does.
        const key = dimension === 'school' ? event.schoolId : event.discipline;
        if (key === null) continue;

        const entry = totals.get(key) ?? { key, totalHours: 0, events: 0, submissions: 0 };
        // The event's hours once, however many people reported it.
        entry.totalHours += event.nbHours;
        entry.events += 1;
        entry.submissions += event.submissions;
        totals.set(key, entry);
      }

      return [...totals.values()]
        .sort((a, b) => b.totalHours - a.totalHours || compareKeys(a.key, b.key))
        .slice(0, limit);
    },
  };
}

/**
 * The tie-break, by code unit rather than by locale.
 *
 * `localeCompare` would be the reflex, and it is the wrong reflex here: it puts
 * `'a'` before `'B'`, which no database's default collation agrees with, so the
 * conformance suite would start failing on ties for reasons that have nothing to
 * do with the ranking. The keys are UAI codes and discipline ids — ASCII, both
 * of them — so a plain comparison is both correct and stable.
 */
function compareKeys(a: string, b: string): number {
  if (a === b) return 0;

  return a < b ? -1 : 1;
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

/** One distinct missed hour — the in-memory shape of the `missed_hour_event` view. */
interface MissedHourEvent extends NewMissedHour {
  /** How many reports describe this hour. */
  submissions: number;
  /** When it was first reported; the rolling window measures from here. */
  firstReportedAt: string;
}

/**
 * Collapse rows into distinct missed hours.
 *
 * The in-memory counterpart of `migrations/007_missed_hour_event_view.ts`, and
 * held to the same numbers by the conformance suite — a SQL `group by` and a JS
 * `Map` are two very different ways to get this wrong.
 *
 * `departement` is taken from the first non-null value rather than being part of
 * the key, for the same reason the view aggregates it: it is nullable until
 * `scripts/backfill-departement.ts` has run, and grouping on it would split one
 * event into a backfilled half and a null half.
 */
function eventsOf(rows: readonly NewMissedHour[]): MissedHourEvent[] {
  const events = new Map<string, MissedHourEvent>();

  for (const row of rows) {
    const key = corroborationKeyOf(row);
    const existing = events.get(key);

    if (!existing) {
      events.set(key, { ...row, submissions: 1, firstReportedAt: row.createdAt });
      continue;
    }

    existing.submissions += 1;
    existing.departement ??= row.departement;

    if (Date.parse(row.createdAt) < Date.parse(existing.firstReportedAt)) {
      existing.firstReportedAt = row.createdAt;
    }
  }

  return [...events.values()];
}
