/**
 * The letter or number that follows the level in a French class name — the "A" in
 * « 6e A », the "3" in « 6e 3 ».
 *
 * A school picks one convention and sticks to it, and the two are positional
 * equivalents: the second class of a level is "B" in one school and "2" in the
 * next. So this stores a single canonical token (the letter) and *shows* both
 * spellings, rather than storing whatever the user happened to type. Two parents
 * from the same school land on the same bucket no matter which convention they
 * think in — which is the whole point, since `classes_affected` counts distinct
 * values.
 *
 * Seven is the practical ceiling: past « G » a level is split across sites, not
 * groups.
 */
export const CLASS_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export type ClassGroup = (typeof CLASS_GROUPS)[number];

/** `'A'` → `'A/1'` — both conventions, so nobody has to translate in their head. */
export function classGroupLabel(group: ClassGroup): string {
  return `${group}/${CLASS_GROUPS.indexOf(group) + 1}`;
}

/**
 * Narrowing guard, used on both edges: the form action validates untrusted POST
 * data with it, and the Postgres repo validates rows coming back out — a `text`
 * column can hold anything a migration or a stray `psql` session put there.
 */
export function isClassGroup(value: unknown): value is ClassGroup {
  return typeof value === 'string' && (CLASS_GROUPS as readonly string[]).includes(value);
}
