import { normalizeText } from '$lib/utils';

/**
 * The school level a missed class belonged to — the « 6e » in « 6e A ».
 *
 * Pairs with [[classGroups]]: this is the level, that is the group within it.
 *
 * **The ids are load-bearing and must not be renamed.** They are already stored
 * in `missed_hour.class` (`1ere`, `2nde`, `5e`, `cm2` … are in the table today),
 * so changing one orphans every row that used it. Labels are display-only and
 * free to change — which is the entire reason they are separated here rather than
 * being one string doing both jobs, as they were before.
 */
export const CLASS_CYCLES = ['elementaire', 'college', 'lycee'] as const;

export type ClassCycle = (typeof CLASS_CYCLES)[number];

export const CLASS_CYCLE_LABELS: Record<ClassCycle, string> = {
  elementaire: 'École élémentaire',
  college: 'Collège',
  lycee: 'Lycée',
};

export interface ClassLevelOption {
  readonly id: string;
  readonly label: string;
  readonly cycle: ClassCycle;
}

export const CLASS_LEVELS = [
  { id: 'cp', label: 'CP', cycle: 'elementaire' },
  { id: 'ce1', label: 'CE1', cycle: 'elementaire' },
  { id: 'ce2', label: 'CE2', cycle: 'elementaire' },
  { id: 'cm1', label: 'CM1', cycle: 'elementaire' },
  { id: 'cm2', label: 'CM2', cycle: 'elementaire' },

  { id: '6e', label: '6e', cycle: 'college' },
  { id: '5e', label: '5e', cycle: 'college' },
  { id: '4e', label: '4e', cycle: 'college' },
  { id: '3e', label: '3e', cycle: 'college' },

  { id: '2nde', label: '2nde', cycle: 'lycee' },
  { id: '1ere', label: '1ère', cycle: 'lycee' },
  { id: 'term', label: 'Terminale', cycle: 'lycee' },
] as const satisfies readonly ClassLevelOption[];

export type ClassLevel = (typeof CLASS_LEVELS)[number]['id'];

/** Levels of one cycle, in curriculum order — one `<Select.Group>` each. */
export function classLevelsInCycle(cycle: ClassCycle): readonly ClassLevelOption[] {
  return CLASS_LEVELS.filter((l) => l.cycle === cycle);
}

/**
 * `'1ere'` → `'1ère'`.
 *
 * Takes a plain `string`, unlike `disciplineLabel`, and that difference is
 * deliberate. `discipline` is nullable, so a value that is not in its mapping can
 * be read back as `null`; `class` is **not** nullable, so there is no such escape
 * — a legacy or hand-edited row has to render as *something*. Falling back to the
 * raw id keeps it visible rather than blanking the row, which is the failure mode
 * this function exists to prevent.
 */
export function classLevelLabel(id: string): string {
  return CLASS_LEVELS.find((l) => l.id === id)?.label ?? id;
}

/**
 * The name fragments that give a school's cycle away, in `CLASS_CYCLES` order.
 *
 * Matched against `normalizeText`d names, so the patterns are accent-free and
 * lowercase: « Lycée » and « LYCEE » both reduce to `lycee`.
 *
 * Anchored at the *start* of a word but deliberately open-ended at the finish, so
 * « Ecole primaire », « Ecole élémentaire » and the plural « Ecoles primaires »
 * all match without three more alternatives. A name may match several — the
 * registry holds twelve « Collège et lycée … » — and each one it matches is a
 * cycle its pupils really are in.
 */
const CYCLE_NAME_PATTERNS: readonly (readonly [ClassCycle, RegExp])[] = [
  ['elementaire', /\b(primaire|elementaire)/],
  ['college', /\bcollege/],
  ['lycee', /\blycee/],
];

/**
 * The cycles worth offering for a school, guessed from its name alone.
 *
 * Falls back to **every** cycle whenever the name settles nothing — no school
 * picked yet, or a name like « Groupe scolaire La Meije » or « Maison Familiale
 * Rurale de Pont-de-Veyle » that never says what it teaches. That default is the
 * important half of the rule: this is a convenience that shortens a twelve-item
 * dropdown, not a validation, and a wrong guess must never make a real class
 * unpickable. Measured over the 51,574 non-maternelle rows of the registry, 3,087
 * fall through to it.
 *
 * Name-based on purpose, unlike `isMaternelle`, which leans on the registry's
 * `Code nature de l'UAI`. The nature code never reaches the browser — `School`
 * carries only what the form and the map need — and the stakes here are far
 * lower: getting it wrong shows a few extra options rather than hiding a school
 * from the search entirely.
 */
export function cyclesForSchoolName(name: string | null | undefined): readonly ClassCycle[] {
  if (!name) return CLASS_CYCLES;

  const haystack = normalizeText(name);
  const matched = CYCLE_NAME_PATTERNS.filter(([, pattern]) => pattern.test(haystack)).map(
    ([cycle]) => cycle
  );

  return matched.length > 0 ? matched : CLASS_CYCLES;
}

/** Guard for untrusted input — the form action's check that a posted level is real. */
export function isClassLevel(value: unknown): value is ClassLevel {
  return typeof value === 'string' && CLASS_LEVELS.some((l) => l.id === value);
}
