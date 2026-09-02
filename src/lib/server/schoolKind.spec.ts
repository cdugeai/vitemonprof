import { describe, expect, it } from 'vitest';
import { MATERNELLE_NATURE_CODES, isMaternelle } from './schoolKind';

/** A registry row, reduced to the two fields the predicate reads. */
function school(natureCode: string, name: string) {
  return { natureCode, name };
}

describe('MATERNELLE_NATURE_CODES', () => {
  it('is the ministry codes for the two kinds of maternelle', () => {
    expect([...MATERNELLE_NATURE_CODES].sort()).toEqual(['101', '103']);
  });
});

describe('isMaternelle', () => {
  describe('by nature code, which is the authoritative classification', () => {
    it.each([
      ['101', 'ECOLE MATERNELLE'],
      ['103', 'ECOLE MATERNELLE D APPLICATION'],
    ])('excludes nature %s', (code, label) => {
      expect(isMaternelle(school(code, label))).toBe(true);
    });

    it.each([
      ['151', 'Ecole élémentaire Jules Ferry'],
      ['340', 'Collège Voltaire'],
      ['300', 'Lycée polyvalent Simone Weil'],
      ['320', 'Lycée professionnel Claude Monet'],
    ])('keeps nature %s', (code, name) => {
      expect(isMaternelle(school(code, name))).toBe(false);
    });

    it('excludes a maternelle whose name never says so', () => {
      // 454 rows in the registry are like this — the name gives nothing away, so
      // a name-only filter would leave every one of them in the list.
      expect(isMaternelle(school('101', 'ECOLE DE LESCHEROUX'))).toBe(true);
      expect(isMaternelle(school('101', 'Ecole élémentaire'))).toBe(true);
    });

    it('tolerates whitespace around the code', () => {
      expect(isMaternelle(school(' 101 ', 'Ecole'))).toBe(true);
    });
  });

  describe('by name, for rows the registry filed under the wrong nature', () => {
    it.each([
      ['Ecole maternelle'],
      ['Ecole maternelle Léon Blum'],
      ['ECOLE MATERNELLE PUBLIQUE DANIEL ARGOTE'],
      ['Ecole Maternelle privée l’Olivier des Enfants'],
      ['Maternelle privée Gan Alef-Beth'],
    ])('excludes %s even when the nature says elementary', (name) => {
      // 91 rows in the registry: named « Ecole maternelle … » but filed as
      // `151 ECOLE DE NIVEAU ELEMENTAIRE`. A parent searching for their child's
      // school would otherwise still find one.
      expect(isMaternelle(school('151', name))).toBe(true);
    });

    it('is accent- and case-insensitive', () => {
      expect(isMaternelle(school('151', 'ÉCOLE MATERNELLE Jean Jaurès'))).toBe(true);
    });

    it('tolerates leading whitespace', () => {
      expect(isMaternelle(school('151', '  Ecole maternelle Mistral'))).toBe(true);
    });
  });

  describe('the anchor, which is what stops the name rule over-reaching', () => {
    it('keeps a primaire that merely mentions a maternelle', () => {
      // Real row. A contains-match would drop it, and it teaches the older
      // children this app is about.
      expect(
        isMaternelle(
          school('151', 'Ecole primaire privée Montessori - Little maternelle - Lyon confluence')
        )
      ).toBe(false);
    });

    it('keeps a school that runs both cycles', () => {
      // Also real. It has élémentaire pupils, so it stays.
      expect(isMaternelle(school('151', 'Ecole Tachbar maternelle et élémentaire privée'))).toBe(
        false
      );
    });

    it('does not match "maternelle" inside a longer first word', () => {
      expect(isMaternelle(school('151', 'Ecole maternellement vôtre'))).toBe(false);
    });
  });
});
