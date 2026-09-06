import { describe, expect, it } from 'vitest';
import { dayWindow, previousDay } from './exportDay';

describe('dayWindow', () => {
  it('spans the named UTC day', () => {
    expect(dayWindow('2026-09-06')).toEqual({
      iso: '2026-09-06',
      stamp: '20260906',
      start: '2026-09-06T00:00:00.000Z',
      end: '2026-09-07T00:00:00.000Z',
    });
  });

  it('rolls over a month, a year and a leap day', () => {
    expect(dayWindow('2026-12-31').end).toBe('2027-01-01T00:00:00.000Z');
    expect(dayWindow('2028-02-29').end).toBe('2028-03-01T00:00:00.000Z');
  });

  it('rejects a day that does not exist rather than rolling it over', () => {
    // `new Date('2026-02-31')` is March 3rd, which would export a day nobody
    // asked for under a filename claiming February.
    expect(() => dayWindow('2026-02-31')).toThrow(/not a real calendar day/);
  });

  it('rejects anything that is not YYYY-MM-DD', () => {
    expect(() => dayWindow('6 sept 2026')).toThrow(/not a YYYY-MM-DD date/);
    expect(() => dayWindow('2026-9-6')).toThrow(/not a YYYY-MM-DD date/);
  });
});

describe('previousDay', () => {
  it('covers the day before the run, whatever time of day it runs', () => {
    expect(previousDay(new Date('2026-09-15T09:30:00Z'))).toEqual({
      iso: '2026-09-14',
      stamp: '20260914',
      start: '2026-09-14T00:00:00.000Z',
      end: '2026-09-15T00:00:00.000Z',
    });
  });

  it('is stable across the whole UTC day it is run in', () => {
    const first = previousDay(new Date('2026-09-15T00:00:00.000Z'));
    const last = previousDay(new Date('2026-09-15T23:59:59.999Z'));

    expect(first).toEqual(last);
  });

  it('rolls back over a month and year boundary', () => {
    expect(previousDay(new Date('2027-01-01T00:00:00.000Z'))).toMatchObject({
      iso: '2026-12-31',
      stamp: '20261231',
    });
  });

  it('rolls back onto a leap day', () => {
    expect(previousDay(new Date('2028-03-01T12:00:00Z'))).toMatchObject({ iso: '2028-02-29' });
  });

  it('leaves the window half-open, so no instant lands in two days', () => {
    const day = previousDay(new Date('2026-09-15T09:30:00Z'));
    const next = previousDay(new Date('2026-09-16T09:30:00Z'));

    // Yesterday's exclusive end is today's inclusive start: the boundary instant
    // belongs to exactly one of the two files.
    expect(day.end).toBe(next.start);
  });

  it('ignores the machine timezone', () => {
    // 01:00 in Paris on the 15th is still the 14th in UTC, so the export run at
    // that instant covers the 13th — the same file a UTC runner would produce.
    expect(previousDay(new Date('2026-09-14T23:00:00Z'))).toMatchObject({ iso: '2026-09-13' });
  });
});
