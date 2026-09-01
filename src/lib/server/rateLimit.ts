import type { NewMissedHour } from '$lib/types/missedHours';

interface RateLimitEntry {
  timestamps: number[];
}

/** When a store gets this big, expired keys are swept before the next insert. */
const MAX_TRACKED_KEYS = 10_000;

/**
 * A sliding-window counter over some key.
 *
 * Two of these exist below and they answer different questions — "is this IP
 * submitting too fast?" and "has this exact report already been sent?" — so they
 * need separate stores. Sharing one `Map` would let a burst key and a duplicate
 * key collide, and `reset()` would be unable to clear just one of them.
 */
function createLimiter() {
  const store = new Map<string, RateLimitEntry>();

  /**
   * Drop keys whose every timestamp has aged out.
   *
   * The burst limiter is keyed by IP and self-limiting in practice. The
   * duplicate limiter is keyed by *IP plus the contents of a report*, so it
   * gains a key for every distinct report anyone files and would otherwise grow
   * for as long as the process lives. Sweeping only once the map is large keeps
   * the common path a single `Map` lookup.
   */
  function sweep(now: number, windowMs: number) {
    for (const [key, entry] of store) {
      if (entry.timestamps.every((ts) => now - ts >= windowMs)) store.delete(key);
    }
  }

  return {
    check(key: string, maxRequests: number, windowMs: number): boolean {
      const now = Date.now();
      const entry = store.get(key) ?? { timestamps: [] };

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

      const isAllowed = entry.timestamps.length < maxRequests;

      if (isAllowed) {
        entry.timestamps.push(now);
        store.set(key, entry);
      }

      if (store.size > MAX_TRACKED_KEYS) sweep(now, windowMs);

      return isAllowed;
    },

    reset(): void {
      store.clear();
    },
  };
}

const burst = createLimiter();
const duplicates = createLimiter();

/**
 * Rate limit based on IP address.
 * Returns true if the request is allowed, false if it exceeds the limit.
 */
export function checkRateLimit(
  ip: string,
  maxRequests: number = 5,
  windowMs: number = 60000
): boolean {
  return burst.check(ip, maxRequests, windowMs);
}

/** How long the exact same report is refused after it is first accepted. */
export const DUPLICATE_WINDOW_MS = 120_000;

/** The fields that make two submissions "the exact same report". */
export type DuplicateKeyFields = Omit<NewMissedHour, 'createdAt' | 'departement'>;

/**
 * A stable string identifying a report's content.
 *
 * `createdAt` is excluded because it differs on every submission by
 * construction — including it would make every report unique and the check a
 * no-op. `departement` is excluded because it is derived from `schoolId` rather
 * than supplied, so it carries no information the school id does not.
 *
 * Everything the reporter actually chose *is* included, `nbHours` and the
 * optional fields among them. Two reports for the same class on the same day
 * that disagree about the subject are two different claims, and whoever made the
 * second one meant to make it — that is the batch case the guard has to let
 * through. (A stricter key than `CORROBORATION_KEY`, which answers a different
 * question: whether two reports describe the same *event*.)
 *
 * `JSON.stringify` over a fixed array rather than over an object: object key
 * order is an implementation detail nobody should have to rely on, and an array
 * makes the order explicit while leaving the escaping to JSON.
 */
export function reportFingerprint(report: DuplicateKeyFields): string {
  return JSON.stringify([
    report.schoolId,
    report.class,
    report.classGroup,
    report.discipline,
    report.date_,
    report.nbHours,
  ]);
}

/**
 * Whether this exact report may be stored, or is a repeat of one just sent.
 *
 * Separate from `checkRateLimit` because the two guard different mistakes. The
 * burst limit is about *volume* — five submissions a minute from one IP,
 * whatever they say. This is about *identity*: a parent reporting a week of
 * absences in one sitting is a legitimate burst of five different reports and
 * must not be blocked, while the same report arriving twice is a double-tapped
 * button or a replayed form and must be.
 *
 * Returns `true` when the report is allowed. The timestamp is recorded only on
 * that branch, so a refused duplicate does **not** extend the window: the block
 * lasts two minutes from the submission that succeeded, not from the last one
 * that bounced. Otherwise someone leaning on the button would keep themselves
 * locked out indefinitely.
 */
export function checkDuplicateSubmission(
  ip: string,
  report: DuplicateKeyFields,
  windowMs: number = DUPLICATE_WINDOW_MS
): boolean {
  // Keyed by IP as well as by content: two people at different addresses
  // reporting the same missed hour is corroboration, which the app deliberately
  // counts. Only a repeat from the same origin is a duplicate.
  return duplicates.check(ip + ' ' + reportFingerprint(report), 1, windowMs);
}

/**
 * Reset the rate limit store. For testing only.
 */
export function resetRateLimitStore(): void {
  burst.reset();
  duplicates.reset();
}
