import { describe, expect, it } from 'vitest';
import { CLASS_LEVELS, classLevelLabel, classLevelsInCycle, isClassLevel } from './classLevels';

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
