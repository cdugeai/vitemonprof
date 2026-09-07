import { describe, expect, it } from 'vitest';
import { buildSchoolSearchIndex, searchSchoolIndex, searchSchools } from './schoolSearch';
import type { School } from './types/school';

function school(partial: Partial<School> & Pick<School, 'id' | 'name' | 'postalCode'>): School {
  return {
    address: '1 rue de la République',
    city: 'PARIS',
    departement: '75',
    latitude: 48.85,
    longitude: 2.35,
    ...partial,
  };
}

/**
 * Deliberately full of « Blaise Pascal »: the ambiguity the postal-code filter
 * exists to resolve is the point of every test below.
 */
const SCHOOLS: School[] = [
  school({ id: 'A', name: 'Lycée Blaise Pascal', postalCode: '63000', city: 'CLERMONT FERRAND' }),
  school({ id: 'B', name: 'Collège Blaise Pascal', postalCode: '63100', city: 'CLERMONT FERRAND' }),
  school({ id: 'C', name: 'Collège Blaise Pascal', postalCode: '92000', city: 'NANTERRE' }),
  school({ id: 'D', name: 'Lycée Jules Verne', postalCode: '63200', city: 'RIOM' }),
  school({ id: 'E', name: 'École élémentaire Vitré', postalCode: '35500', city: 'VITRE' }),
  school({ id: 'F', name: 'Groupe scolaire 8 Mai 1945', postalCode: '35000', city: 'RENNES' }),
];

const INDEX = buildSchoolSearchIndex(SCHOOLS);

function ids(query: string): string[] {
  return searchSchoolIndex(INDEX, query).map((s) => s.id);
}

describe('searchSchoolIndex', () => {
  it('matches on the name, case- and accent-insensitively', () => {
    expect(ids('VITRE')).toEqual(['E']);
  });

  it('matches on the city', () => {
    expect(ids('riom')).toEqual(['D']);
  });

  it('matches a whole postal code', () => {
    expect(ids('63100')).toEqual(['B']);
  });

  it('matches the start of a postal code, so a département narrows the list', () => {
    expect(ids('63')).toEqual(['A', 'B', 'D']);
  });

  it('anchors postal codes at the start rather than anywhere inside', () => {
    // '35' is Ille-et-Vilaine — not the '35' sitting inside 63500 or 92035.
    expect(ids('35')).toEqual(['E', 'F']);
    expect(ids('00')).toEqual([]);
  });

  it('requires every token, so a postal code narrows a common name', () => {
    // The bug this all exists for: three Blaise Pascal, one of them wanted.
    expect(ids('blaise pascal')).toEqual(['A', 'B', 'C']);
    expect(ids('blaise pascal 63')).toEqual(['A', 'B']);
    expect(ids('blaise pascal 63100')).toEqual(['B']);
  });

  it('does not care what order the tokens come in', () => {
    expect(ids('63100 pascal')).toEqual(ids('pascal 63100'));
  });

  it('lets a token match the name even when it is a number', () => {
    // '1945' is part of the name, not a postal code — the name branch catches it.
    expect(ids('1945')).toEqual(['F']);
    expect(ids('scolaire 8 mai')).toEqual(['F']);
  });

  it('matches tokens anywhere and in any order within the name', () => {
    expect(ids('pascal college')).toEqual(['B', 'C']);
  });

  it('returns nothing when the tokens point at different schools', () => {
    expect(ids('pascal 35')).toEqual([]);
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(ids('   blaise    63000  ')).toEqual(['A']);
  });

  it('returns every school for an empty query', () => {
    expect(ids('   ')).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('preserves registry order', () => {
    expect(ids('pascal')).toEqual(['A', 'B', 'C']);
  });
});

describe('searchSchools', () => {
  it('searches a plain array without a prebuilt index', () => {
    expect(searchSchools(SCHOOLS, 'jules 63').map((s) => s.id)).toEqual(['D']);
  });
});
