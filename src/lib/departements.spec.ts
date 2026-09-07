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
      ['98600', '986'],
      ['98700', '987'],
      ['98800', '988'],
    ])('maps the less-quoted %s to %s', (postal, expected) => {
      expect(departementFromPostalCode(postal)).toBe(expected);
    });

    describe('the Antilles collectivités, which do not name themselves', () => {
      // Reported from the field: `9710022X` — Collège Mont des Accords, ST
      // MARTIN — carries postal code 97150, which the plain three-digit rule
      // read as 971 (Guadeloupe). Saint-Barthélemy and Saint-Martin were carved
      // out of Guadeloupe in 2007 and kept the postal codes they already had,
      // so their codes still sit inside Guadeloupe's 971xx block. 41 schools
      // are affected.
      it.each([
        ['97150', '978', 'Saint-Martin — Marigot, incl. Collège Mont des Accords'],
        ['97052', '978', 'Saint-Martin — CEDEX'],
        ['97133', '977', 'Saint-Barthélemy — Gustavia'],
        ['97095', '977', 'Saint-Barthélemy — CEDEX'],
      ])('maps %s to %s (%s)', (postal, expected) => {
        expect(departementFromPostalCode(postal)).toBe(expected);
      });

      it('does not read 97150 as Guadeloupe', () => {
        // The specific regression. `971` is what the three-digit rule returns,
        // and it is wrong for every school in Saint-Martin.
        expect(departementFromPostalCode('97150')).not.toBe('971');
      });

      it('still reads the rest of the 971xx block as Guadeloupe', () => {
        // The fix must be exactly four codes wide: 404 schools genuinely are in
        // Guadeloupe with a 971xx code, and an over-broad rule would move them.
        expect(departementFromPostalCode('97100')).toBe('971');
        expect(departementFromPostalCode('97139')).toBe('971');
        expect(departementFromPostalCode('97151')).toBe('971');
        expect(departementFromPostalCode('97190')).toBe('971');
      });

      it('reads the 978xx block as La Réunion, not Saint-Martin', () => {
        // La Réunion's CEDEX codes. A three-digit rule calls them 978, which is
        // Saint-Martin — 29 schools, all of them 9,000 km off.
        expect(departementFromPostalCode('97800')).toBe('974');
        expect(departementFromPostalCode('97899')).toBe('974');
      });
    });
  });

  describe('known limitations, measured against the registry', () => {
    // 15 schools out of 63,985 (0.023%) where no prefix rule can reach the right
    // answer. Pinned rather than hidden: if a future edit "fixes" one of these,
    // it has almost certainly broken a far larger set, and this is where that
    // shows up.
    it('gets Corsica wrong where the two départements share a prefix', () => {
      // Real Corsican codes interleave: 20537 and 20700 are Corse-du-Sud even
      // though they sit above the 20200 boundary.
      expect(departementFromPostalCode('20537')).toBe('2B'); // INSEE says 2A
      expect(departementFromPostalCode('20700')).toBe('2B'); // INSEE says 2A
    });

    it('gets métropole codes that straddle a border wrong', () => {
      // The post office routes by delivery office, not by administrative
      // boundary, so a handful of communes are served from the next département.
      expect(departementFromPostalCode('05130')).toBe('05'); // INSEE says 04
      expect(departementFromPostalCode('33220')).toBe('33'); // INSEE says 24
      expect(departementFromPostalCode('01200')).toBe('01'); // INSEE says 74
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
  it('is the authoritative source, and disagrees with the postal rule where it must', () => {
    // Collège Mont des Accords again. The registry states 978 outright; the
    // postal code cannot express it. This is why `data.ts` reads the INSEE
    // column first and treats the postal rule as a fallback.
    expect(departementFromInsee('978')).toBe('978');
  });

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
