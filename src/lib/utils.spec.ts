import { describe, expect, it } from 'vitest';
import { formatRelativeTime, normalizeText } from './utils';

/** A fixed "now" so these assertions never depend on the wall clock. */
const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it('says « maintenant » rather than "il y a 0 seconde"', () => {
    // The realistic case for a just-submitted report, and the reason the
    // formatter uses `numeric: 'auto'`.
    expect(formatRelativeTime(ago(0), NOW)).toBe('maintenant');
  });

  it('agrees in number, which is the whole reason for using Intl', () => {
    expect(formatRelativeTime(ago(1 * MINUTE), NOW)).toBe('il y a 1 minute');
    expect(formatRelativeTime(ago(3 * MINUTE), NOW)).toBe('il y a 3 minutes');
  });

  it('steps up to the next unit at its boundary', () => {
    // The bug this replaced: the old counter kept saying "90 min".
    expect(formatRelativeTime(ago(59 * SECOND), NOW)).toBe('il y a 59 secondes');
    expect(formatRelativeTime(ago(1 * MINUTE), NOW)).toBe('il y a 1 minute');
    expect(formatRelativeTime(ago(90 * MINUTE), NOW)).toBe('il y a 1 heure');
    expect(formatRelativeTime(ago(5 * HOUR), NOW)).toBe('il y a 5 heures');
    expect(formatRelativeTime(ago(2 * DAY), NOW)).toBe('avant-hier');
  });

  it('reads a future timestamp as future, so the sign cannot silently flip', () => {
    // `(timestamp - now)` is what makes past negative. Inverting it would make
    // every report read « dans 5 minutes », which no other assertion here catches.
    expect(formatRelativeTime(ago(-5 * MINUTE), NOW)).toBe('dans 5 minutes');
  });

  it('stays French regardless of the host locale', () => {
    expect(formatRelativeTime(ago(3 * MINUTE), NOW)).toContain('il y a');
  });
});

describe('normalizeText', () => {
  it('folds case and strips diacritics so a search box does not demand accents', () => {
    expect(normalizeText('Français')).toBe('francais');
    expect(normalizeText('MATHÉMATIQUES')).toBe('mathematiques');
    expect(normalizeText('Vitré')).toBe(normalizeText('VITRE'));
  });
});
