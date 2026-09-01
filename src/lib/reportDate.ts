/**
 * How far in the future a reported date may be.
 *
 * One day, not zero — and the reason is timezones, not generosity.
 *
 * The browser's date picker offers a **local** calendar day, while the server
 * has only an instant. Comparing that local day against UTC midnight rejects a
 * genuine same-day report for as long as the user's local date runs ahead of
 * UTC: in Paris that is every night between 00:00 and 02:00 (01:00 in winter),
 * during which nobody could report a class from that same day.
 *
 * Anchoring to Europe/Paris instead would fix métropole and break the
 * collectivités, which this app deliberately covers — French territory spans
 * UTC-10 (Polynésie) to UTC+12 (Wallis-et-Futuna), so at any instant the local
 * date somewhere in France is UTC's ±1.
 *
 * One day of slack covers all of it with no timezone table and no guessing where
 * the reporter is. What it costs is that a Paris user could file for tomorrow,
 * which is a harmless thing to be able to do — this bound exists to catch
 * `2099-12-31`, not to police a 24-hour window.
 */
export const MAX_FUTURE_DAYS = 1;

/** Roughly one school year, plus the same day of timezone slack. */
export const MAX_AGE_DAYS = 365 + 1;

/**
 * Whether `value` is a `YYYY-MM-DD` date a report may carry.
 *
 * Three checks: the shape, that it is a real calendar day, and that it falls
 * inside the allowed window.
 *
 * `2026-02-31` matches the shape but is not a day, and `Date.parse` would
 * quietly roll it over to March 3rd — round-tripping through ISO catches that.
 *
 * `now` is injected so the boundaries can be tested at a chosen instant rather
 * than at whatever time the suite happens to run. That is not a hypothetical
 * nicety: the bug this function was extracted to fix only reproduced between
 * midnight and 02:00, so a test that could not choose its clock could not have
 * caught it.
 */
export function isReportableDate(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(value)) {
    return false;
  }

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const latest = new Date(today);
  latest.setUTCDate(today.getUTCDate() + MAX_FUTURE_DAYS);

  const earliest = new Date(today);
  earliest.setUTCDate(today.getUTCDate() - MAX_AGE_DAYS);

  return parsed <= latest && parsed >= earliest;
}
