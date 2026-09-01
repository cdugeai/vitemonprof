import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DUPLICATE_WINDOW_MS,
  checkDuplicateSubmission,
  checkRateLimit,
  reportFingerprint,
  resetRateLimitStore,
  type DuplicateKeyFields,
} from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimitStore();
  });

  it('allows up to 5 requests within the window', () => {
    const ip = '192.168.1.1';

    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
  });

  it('blocks the 6th request within the window', () => {
    const ip = '192.168.1.1';

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }

    expect(checkRateLimit(ip)).toBe(false);
  });

  it('blocks subsequent requests while at limit', () => {
    const ip = '192.168.1.1';

    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip);
    }

    expect(checkRateLimit(ip)).toBe(false);
    expect(checkRateLimit(ip)).toBe(false);
    expect(checkRateLimit(ip)).toBe(false);
  });

  it('tracks different IPs independently', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(ip1)).toBe(true);
    }

    expect(checkRateLimit(ip1)).toBe(false);

    // ip2 should still be allowed
    expect(checkRateLimit(ip2)).toBe(true);
    expect(checkRateLimit(ip2)).toBe(true);
  });

  it('allows more requests after the window expires', () => {
    const ip = '192.168.1.1';

    // Use up 5 requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip);
    }

    expect(checkRateLimit(ip)).toBe(false);

    // Advance time by 60 seconds (the default window)
    vi.advanceTimersByTime(60000);

    // Should now be allowed again
    expect(checkRateLimit(ip)).toBe(true);
  });

  it('respects custom window size', () => {
    const ip = '192.168.1.1';
    const customWindow = 30000; // 30 seconds

    // Use up 5 requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip, 5, customWindow);
    }

    expect(checkRateLimit(ip, 5, customWindow)).toBe(false);

    // Advance time by less than the window
    vi.advanceTimersByTime(20000);
    expect(checkRateLimit(ip, 5, customWindow)).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(10000);
    expect(checkRateLimit(ip, 5, customWindow)).toBe(true);
  });

  it('respects custom max requests limit', () => {
    const ip = '192.168.1.1';
    const maxRequests = 3;

    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(ip, maxRequests)).toBe(true);
    }

    expect(checkRateLimit(ip, maxRequests)).toBe(false);
  });
});

/**
 * A valid report. Every test below varies exactly one field from this, so what
 * each one is really asserting is visible in its own body.
 */
function report(overrides: Partial<DuplicateKeyFields> = {}): DuplicateKeyFields {
  return {
    schoolId: '0761322Z',
    class: '1ere',
    classGroup: 'C',
    discipline: 'maths',
    date_: '2026-08-17',
    nbHours: 2,
    ...overrides,
  };
}

describe('reportFingerprint', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('is stable for the same content', () => {
    expect(reportFingerprint(report())).toBe(reportFingerprint(report()));
  });

  it.each([
    ['schoolId', { schoolId: '0010001W' }],
    ['class', { class: '6e' }],
    ['classGroup', { classGroup: 'D' as const }],
    ['discipline', { discipline: 'svt' as const }],
    ['date', { date_: '2026-08-18' }],
    ['nbHours', { nbHours: 3 }],
  ])('changes when the %s changes', (_field, difference) => {
    expect(reportFingerprint(report(difference))).not.toBe(reportFingerprint(report()));
  });

  it('distinguishes a null optional field from an absent one', () => {
    // `null` and "not chosen" have to stay distinguishable from a filled value,
    // or clearing the discipline would look like the same report.
    expect(reportFingerprint(report({ discipline: null }))).not.toBe(
      reportFingerprint(report({ discipline: 'maths' }))
    );
  });

  it('does not let one field spill into the next', () => {
    // The classic separator bug: with a naive `a + ':' + b` these two collide.
    // JSON quoting is what prevents it.
    const left = report({ schoolId: 'A:B', class: 'C' });
    const right = report({ schoolId: 'A', class: 'B:C' });

    expect(reportFingerprint(left)).not.toBe(reportFingerprint(right));
  });
});

describe('checkDuplicateSubmission', () => {
  const ip = '192.168.1.1';

  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimitStore();
  });

  it('allows a report the first time', () => {
    expect(checkDuplicateSubmission(ip, report())).toBe(true);
  });

  it('blocks the exact same report sent again', () => {
    checkDuplicateSubmission(ip, report());

    expect(checkDuplicateSubmission(ip, report())).toBe(false);
  });

  it.each([
    ['school', { schoolId: '0010001W' }],
    ['class', { class: '6e' }],
    ['class group', { classGroup: 'D' as const }],
    ['discipline', { discipline: 'svt' as const }],
    ['date', { date_: '2026-08-18' }],
    ['number of hours', { nbHours: 3 }],
  ])('allows a report differing only in the %s', (_field, difference) => {
    checkDuplicateSubmission(ip, report());

    expect(checkDuplicateSubmission(ip, report(difference))).toBe(true);
  });

  it('lets a batch of different reports through back to back', () => {
    // The case the guard must not break: one person filing a week of absences
    // in one sitting. Five distinct reports, no delay between them.
    const week = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'];

    const results = week.map((date_) => checkDuplicateSubmission(ip, report({ date_ })));

    expect(results).toEqual([true, true, true, true, true]);
  });

  it('tracks different IPs independently', () => {
    // Two people reporting the same missed hour is corroboration, which the app
    // counts on purpose — see CORROBORATION_KEY. Only a repeat from the same
    // origin is a duplicate.
    checkDuplicateSubmission('192.168.1.1', report());

    expect(checkDuplicateSubmission('192.168.1.2', report())).toBe(true);
  });

  it('allows the report again once the window has passed', () => {
    checkDuplicateSubmission(ip, report());

    vi.advanceTimersByTime(DUPLICATE_WINDOW_MS);

    expect(checkDuplicateSubmission(ip, report())).toBe(true);
  });

  it('still blocks one millisecond before the window closes', () => {
    checkDuplicateSubmission(ip, report());

    vi.advanceTimersByTime(DUPLICATE_WINDOW_MS - 1);

    expect(checkDuplicateSubmission(ip, report())).toBe(false);
  });

  it('does not extend the window when it refuses', () => {
    checkDuplicateSubmission(ip, report());

    // Someone leaning on the button for the whole two minutes. If a refusal
    // recorded a timestamp, each attempt would push the expiry out and lock
    // them out forever.
    vi.advanceTimersByTime(DUPLICATE_WINDOW_MS / 2);
    expect(checkDuplicateSubmission(ip, report())).toBe(false);

    vi.advanceTimersByTime(DUPLICATE_WINDOW_MS / 2);
    expect(checkDuplicateSubmission(ip, report())).toBe(true);
  });

  it('is two minutes by default', () => {
    expect(DUPLICATE_WINDOW_MS).toBe(120_000);
  });

  it('respects a custom window', () => {
    checkDuplicateSubmission(ip, report(), 30_000);

    expect(checkDuplicateSubmission(ip, report(), 30_000)).toBe(false);

    vi.advanceTimersByTime(30_000);

    expect(checkDuplicateSubmission(ip, report(), 30_000)).toBe(true);
  });

  it('keeps its own store, separate from the burst limit', () => {
    // Spending the burst quota must not consume the duplicate budget, and vice
    // versa — one shared Map would let a bare IP key collide with a
    // fingerprinted one.
    for (let i = 0; i < 5; i++) checkRateLimit(ip);

    expect(checkRateLimit(ip)).toBe(false);
    expect(checkDuplicateSubmission(ip, report())).toBe(true);
  });

  it('is cleared by resetRateLimitStore, which the E2E hook relies on', () => {
    checkDuplicateSubmission(ip, report());

    resetRateLimitStore();

    expect(checkDuplicateSubmission(ip, report())).toBe(true);
  });
});
