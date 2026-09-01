import { describe, expect, it } from 'vitest';
import { MAX_AGE_DAYS, MAX_FUTURE_DAYS, isReportableDate } from './reportDate';

/**
 * A fixed instant, chosen to be the one that used to break.
 *
 * 00:13 on 2 September in Paris (UTC+2 in summer) is 22:13 on 1 September in
 * UTC. So the date picker offers `2026-09-02` while the server's idea of "today"
 * is still `2026-09-01` — and the old check called that a future date.
 */
const JUST_AFTER_PARIS_MIDNIGHT = new Date('2026-09-01T22:13:00.000Z');

/** A boring mid-afternoon instant, where local and UTC dates agree everywhere. */
const MIDDAY_UTC = new Date('2026-09-01T12:00:00.000Z');

describe('isReportableDate', () => {
  describe('shape', () => {
    it.each([['2026-9-1'], ['01/09/2026'], ['2026-09-01T00:00:00Z'], [''], ['yesterday']])(
      'rejects %s',
      (value) => {
        expect(isReportableDate(value, MIDDAY_UTC)).toBe(false);
      }
    );

    it('rejects a date that matches the shape but is not a day', () => {
      // `Date.parse` would roll this over to March 3rd rather than fail.
      expect(isReportableDate('2026-02-31', MIDDAY_UTC)).toBe(false);
    });

    it('accepts a real leap day', () => {
      expect(isReportableDate('2024-02-29', new Date('2024-03-01T12:00:00.000Z'))).toBe(true);
    });
  });

  describe('the midnight bug', () => {
    it('accepts the local day just after Paris midnight, when UTC is still on the previous day', () => {
      // The regression. Between 00:00 and 02:00 Paris time nobody could report a
      // class from that same day: the picker offered 2026-09-02 and the server
      // compared it against a UTC "today" of 2026-09-01.
      expect(isReportableDate('2026-09-02', JUST_AFTER_PARIS_MIDNIGHT)).toBe(true);
    });

    it('still accepts the UTC day at that same instant', () => {
      expect(isReportableDate('2026-09-01', JUST_AFTER_PARIS_MIDNIGHT)).toBe(true);
    });

    it('accepts a local day that runs behind UTC, as in Polynésie', () => {
      // UTC-10. At 21:00 on 1 September local it is 07:00 on 2 September in UTC,
      // so the reporter's own day is the one *before* the server's.
      expect(isReportableDate('2026-09-01', new Date('2026-09-02T07:00:00.000Z'))).toBe(true);
    });

    it('accepts a local day that runs ahead of UTC, as in Wallis-et-Futuna', () => {
      // UTC+12. At 09:00 on 2 September local it is 21:00 on 1 September in UTC.
      expect(isReportableDate('2026-09-02', new Date('2026-09-01T21:00:00.000Z'))).toBe(true);
    });
  });

  describe('the future bound', () => {
    it('accepts today', () => {
      expect(isReportableDate('2026-09-01', MIDDAY_UTC)).toBe(true);
    });

    it(`accepts exactly ${MAX_FUTURE_DAYS} day ahead, which is the timezone slack`, () => {
      expect(isReportableDate('2026-09-02', MIDDAY_UTC)).toBe(true);
    });

    it('rejects two days ahead, which no timezone can explain', () => {
      expect(isReportableDate('2026-09-03', MIDDAY_UTC)).toBe(false);
    });

    it('rejects the far future', () => {
      // The case this bound actually exists for.
      expect(isReportableDate('2099-12-31', MIDDAY_UTC)).toBe(false);
    });
  });

  describe('the age bound', () => {
    it('accepts a date inside the school year', () => {
      expect(isReportableDate('2026-03-01', MIDDAY_UTC)).toBe(true);
    });

    it(`accepts exactly ${MAX_AGE_DAYS} days back`, () => {
      const oldest = new Date(MIDDAY_UTC);
      oldest.setUTCHours(0, 0, 0, 0);
      oldest.setUTCDate(oldest.getUTCDate() - MAX_AGE_DAYS);

      expect(isReportableDate(oldest.toISOString().slice(0, 10), MIDDAY_UTC)).toBe(true);
    });

    it(`rejects one day beyond ${MAX_AGE_DAYS}`, () => {
      const tooOld = new Date(MIDDAY_UTC);
      tooOld.setUTCHours(0, 0, 0, 0);
      tooOld.setUTCDate(tooOld.getUTCDate() - MAX_AGE_DAYS - 1);

      expect(isReportableDate(tooOld.toISOString().slice(0, 10), MIDDAY_UTC)).toBe(false);
    });
  });

  it('defaults to the real clock when no instant is given', () => {
    // The production call site passes no `now`, so the default has to work.
    const todayUtc = new Date().toISOString().slice(0, 10);

    expect(isReportableDate(todayUtc)).toBe(true);
  });
});
