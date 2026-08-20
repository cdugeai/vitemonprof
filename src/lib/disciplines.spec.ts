import { describe, expect, it } from 'vitest';
import { DISCIPLINES, isDiscipline, searchDisciplines } from './disciplines';

const labels = (query: string) => searchDisciplines(query).map((d) => d.label);

describe('searchDisciplines', () => {
  it('returns the whole list for an empty query', () => {
    // The list is local, so the dropdown should open showing everything and
    // narrow as you type — not start empty.
    expect(searchDisciplines('')).toHaveLength(DISCIPLINES.length);
    expect(searchDisciplines('   ')).toHaveLength(DISCIPLINES.length);
  });

  it('ignores accents and case', () => {
    expect(labels('francais')).toContain('Français');
    expect(labels('MATHEMATIQUES')).toContain('Mathématiques');
  });

  it('matches anywhere in the label, not just the start', () => {
    expect(labels('anglais')).toContain('LV Anglais');
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchDisciplines('zzzzz')).toEqual([]);
  });

  it('preserves declaration order so the groups stay in curriculum order', () => {
    const found = searchDisciplines('sciences');
    const positions = found.map((d) => DISCIPLINES.findIndex((x) => x.id === d.id));

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('isDiscipline', () => {
  it('accepts every id in the mapping', () => {
    expect(DISCIPLINES.every((d) => isDiscipline(d.id))).toBe(true);
  });

  it('rejects anything else, which is what keeps unrenderable ids out of the table', () => {
    // A stored id with no entry in the mapping can never be turned back into a
    // label, so the form action refuses it rather than writing a dead row.
    for (const bad of ['', 'chimie-quantique', 'Mathématiques', null, undefined, 42, {}]) {
      expect(isDiscipline(bad)).toBe(false);
    }
  });
});
