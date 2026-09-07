import { describe, expect, it } from 'vitest';
import {
  CLASS_CYCLES,
  CLASS_LEVELS,
  classLevelLabel,
  classLevelsInCycle,
  cyclesForSchoolName,
  isClassLevel,
} from './classLevels';

describe('CLASS_LEVELS', () => {
  it('keeps the ids already written to the database', () => {
    // Not a style check — these exact strings sit in `missed_hour.class` today.
    // Renaming one silently orphans every row that used it, and this test is the
    // only thing standing between a tidy-up and that happening.
    const ids = CLASS_LEVELS.map((l) => l.id);

    expect(ids).toEqual([
      'cp',
      'ce1',
      'ce2',
      'cm1',
      'cm2',
      '6e',
      '5e',
      '4e',
      '3e',
      '2nde',
      '1ere',
      'term',
    ]);
  });

  it('assigns every level to exactly one cycle', () => {
    const grouped = (['elementaire', 'college', 'lycee'] as const).flatMap((c) =>
      classLevelsInCycle(c)
    );

    expect(grouped).toHaveLength(CLASS_LEVELS.length);
  });
});

describe('classLevelLabel', () => {
  it('turns a stored id into the human label', () => {
    expect(classLevelLabel('1ere')).toBe('1ère');
    expect(classLevelLabel('term')).toBe('Terminale');
    expect(classLevelLabel('cm2')).toBe('CM2');
  });

  it('falls back to the raw id instead of blanking an unknown value', () => {
    // `class` is not nullable, so a legacy or hand-edited row has to render as
    // *something*. Showing the id beats showing nothing.
    expect(classLevelLabel('mystere')).toBe('mystere');
  });
});

describe('isClassLevel', () => {
  it('accepts every id in the mapping', () => {
    expect(CLASS_LEVELS.every((l) => isClassLevel(l.id))).toBe(true);
  });

  it('rejects labels, sentinels and non-strings', () => {
    // '1ère' is the *label*; posting it would store a value nothing can look up.
    // 'none' was the old sentinel the form action special-cased.
    for (const bad of ['', 'none', '1ère', 'Terminale', null, undefined, 7]) {
      expect(isClassLevel(bad)).toBe(false);
    }
  });
});

describe('cyclesForSchoolName', () => {
  it('narrows to the one cycle the name announces', () => {
    expect(cyclesForSchoolName('Collège Georges Brassens')).toEqual(['college']);
    expect(cyclesForSchoolName('Lycée polyvalent Georges Brassens')).toEqual(['lycee']);
    expect(cyclesForSchoolName('Ecole élémentaire Arthur Fleury')).toEqual(['elementaire']);
    expect(cyclesForSchoolName("Ecole primaire privée Jeanne d'Arc")).toEqual(['elementaire']);
  });

  it('ignores case and accents, like every other match in the app', () => {
    // Registry names are inconsistent about both: « LYCEE », « Lycée », « Ecole
    // élémentaire » and « ECOLE ELEMENTAIRE » all appear in the file.
    expect(cyclesForSchoolName('LYCEE GENERAL ET TECHNOLOGIQUE MONTAIGNE')).toEqual(['lycee']);
    expect(cyclesForSchoolName('ECOLE ELEMENTAIRE PUBLIQUE')).toEqual(['elementaire']);
  });

  it('keeps every cycle a name claims, in curriculum order', () => {
    // « Collège et lycée … » rows exist in the registry, and their pupils really
    // do span both cycles.
    expect(cyclesForSchoolName('Collège et lycée Saint-Joseph')).toEqual(['college', 'lycee']);
    expect(cyclesForSchoolName('Lycée et collège Saint-Joseph')).toEqual(['college', 'lycee']);
  });

  it('falls back to every cycle when the name settles nothing', () => {
    // The important half of the rule: this shortens a dropdown, it does not
    // validate anything, so a name it cannot read must never hide a real class.
    for (const name of [
      undefined,
      null,
      '',
      'Groupe scolaire La Meije',
      'Maison Familiale Rurale de Pont-de-Veyle',
      "Etablissement régional d'enseignement adapté",
    ]) {
      expect(cyclesForSchoolName(name)).toEqual([...CLASS_CYCLES]);
    }
  });

  it('only ever returns real cycles', () => {
    const cycles = cyclesForSchoolName('Cité scolaire');

    expect(cycles.every((c) => CLASS_CYCLES.includes(c))).toBe(true);
  });
});
