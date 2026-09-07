import { describe, expect, it } from 'vitest';
import {
  DEPARTEMENTS,
  departementFromInsee,
  departementFromPostalCode,
  departementLabel,
  isDepartement,
} from './departements';

describe('DEPARTEMENTS', () => {
  it('covers metropolitan France, Corsica and every overseas collectivité', () => {
    // 94 numbered métropole (01-95 with no 20) + 2A/2B + 11 overseas.
    expect(DEPARTEMENTS).toHaveLength(107);
  });

  it('has no duplicate codes', () => {
    const codes = DEPARTEMENTS.map((d) => d.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('never zero-pads a code to three characters', () => {
    // `'075'` and `'75'` both look reasonable and would silently split Paris in
    // two the moment one of them reached the database. `'01'` is fine — the
    // padding this rules out is the registry's three-character INSEE spelling.
    expect(DEPARTEMENTS.filter((d) => d.code.length === 3 && d.code.startsWith('0'))).toEqual([]);
  });

  it('has no "20" — Corsica is 2A and 2B', () => {
    expect(isDepartement('20')).toBe(false);
    expect(isDepartement('2A')).toBe(true);
    expect(isDepartement('2B')).toBe(true);
  });
});

describe('isDepartement', () => {
  it.each([['01'], ['75'], ['2A'], ['971'], ['988']])('accepts %s', (code) => {
    expect(isDepartement(code)).toBe(true);
  });

  it.each([['00'], ['96'], ['20'], ['075'], ['979'], [''], ['abc']])('rejects %s', (code) => {
    expect(isDepartement(code)).toBe(false);
  });

  it('rejects non-strings without throwing', () => {
    expect([null, undefined, 75, {}].map(isDepartement)).toEqual([false, false, false, false]);
  });
});

describe('departementLabel', () => {
  it('renders code and name', () => {
    expect(departementLabel('2A')).toBe('2A - Corse-du-Sud');
  });

  it('falls back to the bare code rather than rendering "undefined"', () => {
    expect(departementLabel('999')).toBe('999');
  });
});

describe('departementFromPostalCode', () => {
  it.each([
    ['01500', '01'],
    ['75014', '75'],
    ['76085', '76'],
    ['95000', '95'],
  ])('takes the first two digits of %s', (postal, expected) => {
    expect(departementFromPostalCode(postal)).toBe(expected);
  });

  describe('Corsica', () => {
    // The published boundary: 20000-20190 is Corse-du-Sud, 20200-20600 is
    // Haute-Corse. Implemented as a split at 20200 so the gap between the two
    // published ranges resolves rather than returning null.
    it.each([
      ['20000', '2A'],
      ['20090', '2A'],
      ['20190', '2A'],
      ['20199', '2A'],
      ['20200', '2B'],
      ['20220', '2B'],
      ['20600', '2B'],
      ['20620', '2B'],
    ])('maps %s to %s', (postal, expected) => {
      expect(departementFromPostalCode(postal)).toBe(expected);
    });

    it('never returns the bare "20", which is not a département', () => {
      expect(departementFromPostalCode('20000')).not.toBe('20');
    });
  });

  describe('overseas', () => {
    it.each([
      ['97100', '971'],
      ['97190', '971'],
      ['97200', '972'],
      ['97290', '972'],
      ['97300', '973'],
      ['97390', '973'],
      ['97400', '974'],
      ['97490', '974'],
      ['97600', '976'],
      ['97690', '976'],
    ])('maps %s to %s', (postal, expected) => {
      expect(departementFromPostalCode(postal)).toBe(expected);
    });

    it.each([
      ['97500', '975'],
      ['97133', '971'],
      ['97700', '977'],
      ['97800', '978'],
      ['98600', '986'],
      ['98700', '987'],
      ['98800', '988'],
    ])('maps the less-quoted %s to %s', (postal, expected) => {
      // 977 and 978 in particular: "from 97600 up is Mayotte" would fold
      // Saint-Barthélemy and Saint-Martin — 42 schools — into 976.
      expect(departementFromPostalCode(postal)).toBe(expected);
    });
  });

  it.each([['1500'], ['015000'], [''], ['   '], ['7501A'], ['abcde']])(
    'returns null for the malformed %s',
    (postal) => {
      expect(departementFromPostalCode(postal)).toBeNull();
    }
  );

  it.each([['96000'], ['97000'], ['99000']])(
    'returns null for %s, which is well-formed but not a département',
    (postal) => {
      expect(departementFromPostalCode(postal)).toBeNull();
    }
  );

  it('tolerates surrounding whitespace', () => {
    expect(departementFromPostalCode(' 75014 ')).toBe('75');
  });
});

describe('departementFromInsee', () => {
  it.each([
    ['001', '01'],
    ['075', '75'],
    ['095', '95'],
    ['02A', '2A'],
    ['02B', '2B'],
    ['971', '971'],
    ['988', '988'],
  ])('unpads %s to %s', (insee, expected) => {
    expect(departementFromInsee(insee)).toBe(expected);
  });

  it('leaves an already-short code alone', () => {
    expect(departementFromInsee('75')).toBe('75');
  });

  it.each([['999'], ['000'], [''], ['xx']])('returns null for %s', (insee) => {
    expect(departementFromInsee(insee)).toBeNull();
  });
});
