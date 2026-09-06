/**
 * The day a CSV export covers.
 *
 * The exports are a daily job — run on the 15th, publish the 14th — so one
 * value has to answer two questions that must never disagree: which rows go in
 * the file, and which date the filename claims. Deriving both from a single
 * `ExportDay` is the whole point of this module; computing the window in SQL
 * (`current_date - 1`) and the filename in JS would leave two clocks, in two
 * timezones, free to straddle midnight differently.
 *
 * **UTC, not Europe/Paris.** Same reasoning as `MAX_FUTURE_DAYS` in
 * `$lib/reportDate`: French territory runs from UTC-10 to UTC+12, so there is no
 * local midnight that is local for everyone the site covers. UTC is the one
 * boundary that is arbitrary for all of them equally — and, being independent of
 * where the job runs, it makes a scheduled runner and a laptop in Paris produce
 * byte-identical files.
 */
export interface ExportDay {
  /** The day covered, `YYYY-MM-DD`. */
  readonly iso: string;
  /** The same day as `YYYYMMDD`, for filenames. */
  readonly stamp: string;
  /** Inclusive lower bound of the window, as an ISO instant. */
  readonly start: string;
  /** **Exclusive** upper bound — the following midnight. */
  readonly end: string;
}

/**
 * The window covering one named UTC day, `YYYY-MM-DD`.
 *
 * Throws on anything that is not a real calendar day. `2026-02-31` matches the
 * shape but does not exist, and `Date.parse` would quietly roll it over to March
 * 3rd — an export silently covering a day nobody asked for. Round-tripping
 * through ISO catches that, the same way `isReportableDate` does.
 */
export function dayWindow(iso: string): ExportDay {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error(`not a YYYY-MM-DD date: ${iso}`);
  }

  const start = new Date(`${iso}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || !start.toISOString().startsWith(iso)) {
    throw new Error(`not a real calendar day: ${iso}`);
  }

  // Half-open: `created_at >= start and created_at < end`. Not `between`, which
  // is inclusive at both ends and would file a report written at exactly
  // 00:00:00.000 into two days at once.
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);

  return {
    iso,
    stamp: iso.replaceAll('-', ''),
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Yesterday — the day a scheduled run publishes.
 *
 * `now` is injected so the boundaries can be tested at a chosen instant instead
 * of at whatever time the suite happens to run.
 */
export function previousDay(now: Date = new Date()): ExportDay {
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  midnight.setUTCDate(midnight.getUTCDate() - 1);

  return dayWindow(midnight.toISOString().slice(0, 10));
}
