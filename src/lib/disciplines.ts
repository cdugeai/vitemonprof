/**
 * The subject a missed class belonged to.
 *
 * Sourced from the lycée général curriculum: the common core (« enseignements
 * communs ») plus the thirteen specialities a student picks from. The list is
 * offered at every class level, so a CP report can technically name « HGGSP » —
 * a deliberate choice to keep the form simple, not an oversight. If the data ever
 * needs to be trustworthy per level, the fix is a `levels` field here plus a
 * filter in the selector; nothing else would have to change.
 *
 * Two shapes of value live in this file and they must not be confused:
 * - `id` is what gets stored. It is an opaque, stable token — renaming a `label`
 *   is a display change, renaming an `id` orphans every row already written.
 * - `label` is what a human reads, and is free to change.
 *
 * `as const satisfies` rather than a plain annotation: `satisfies` checks each
 * entry against `DisciplineOption` while `as const` keeps the literal types, so
 * `Discipline` below resolves to the actual union of ids rather than `string`.
 * A plain `: readonly DisciplineOption[]` would widen it and lose the safety.
 */
export const DISCIPLINE_GROUPS = ['commun', 'lang', 'specialite'] as const;

export type DisciplineGroup = (typeof DISCIPLINE_GROUPS)[number];

export const DISCIPLINE_GROUP_LABELS: Record<DisciplineGroup, string> = {
  lang: 'Langues',
  commun: 'Enseignements communs',
  specialite: 'Enseignements de spécialité',
};

export interface DisciplineOption {
  readonly id: string;
  readonly label: string;
  readonly group: DisciplineGroup;
  /** Availability caveat from the curriculum, shown as a hint rather than enforced. */
  readonly note?: string;
}

export const DISCIPLINES = [
  // — Enseignements communs —
  { id: 'french', label: 'Français', group: 'commun' },
  { id: 'philo', label: 'Philosophie', group: 'commun' },
  { id: 'hist-geo', label: 'Histoire-géographie', group: 'commun' },
  // The curriculum calls these "langues vivantes A et B" — two slots, not two
  // named languages. Storing the language instead of the slot is the more useful
  // fact: "l'heure d'anglais" is what a parent actually reports, and « LV autre »
  // catches italien, chinois, and the regional languages without listing them all.
  //
  // Labels stay in the short « LV Anglais » form rather than spelling out "Langue
  // vivante": `RecentReports` already joins with an em dash, so a label containing
  // its own dash renders as "dans term A — Langue vivante — anglais".
  { id: 'lv-en', label: 'LV Anglais', group: 'lang' },
  { id: 'lv-spa', label: 'LV Espagnol', group: 'lang' },
  { id: 'lv-ger', label: 'LV Allemand', group: 'lang' },
  { id: 'lv-other', label: 'LV autre', group: 'lang' },
  { id: 'sport', label: 'Éducation physique et sportive (EPS)', group: 'commun' },
  { id: 'emc', label: 'Enseignement moral et civique (EMC)', group: 'commun' },

  { id: 'maths', label: 'Mathématiques', group: 'commun' },
  { id: 'phys-ch', label: 'Physique-chimie', group: 'commun' },
  // — Les 11 enseignements de spécialité —
  { id: 'svt', label: 'Sciences de la vie et de la Terre (SVT)', group: 'specialite' },
  { id: 'ses', label: 'Sciences économiques et sociales (SES)', group: 'specialite' },
  {
    id: 'gsp',
    label: 'Géopolitique et sciences politiques',
    group: 'specialite',
  },
  { id: 'hlp', label: 'Humanités, littérature et philosophie (HLP)', group: 'specialite' },
  { id: 'nsi', label: 'Numérique et sciences informatiques (NSI)', group: 'specialite' },
  { id: 'sci-eng', label: "Sciences de l'ingénieur", group: 'specialite' },
  {
    id: 'arts',
    label: 'Arts',
    group: 'specialite',
  },
  {
    id: 'biologie-ecologie',
    label: 'Biologie-écologie',
    group: 'specialite',
  },
] as const satisfies readonly DisciplineOption[];

export type Discipline = (typeof DISCIPLINES)[number]['id'];

/**
 * Options for one `<Select.Group>`, in declaration order.
 *
 * The `readonly DisciplineOption[]` return type is deliberate. `as const` gives
 * every entry its own exact literal type, so entries without a `note` genuinely
 * do not have the property and the union has no common `note` to read — the
 * template can't write `discipline.note` at all. Widening here restores the
 * uniform `note?: string` shape for rendering, while `Discipline` above stays
 * derived from the raw `DISCIPLINES` and keeps its narrow union of ids.
 * Precision where it protects the data, ergonomics where it only has to render.
 */
export function disciplinesInGroup(group: DisciplineGroup): readonly DisciplineOption[] {
  return DISCIPLINES.filter((d) => d.group === group);
}

/** `'hggsp'` → the full human label. Falls back to the id so an unknown value is
 * still visible in the UI rather than rendering as a blank. */
export function disciplineLabel(id: Discipline): string {
  return DISCIPLINES.find((d) => d.id === id)?.label ?? id;
}

/** Same role as `isClassGroup`: the guard used on both edges — untrusted POST
 * data on the way in, and `text` columns on the way out. */
export function isDiscipline(value: unknown): value is Discipline {
  return typeof value === 'string' && DISCIPLINES.some((d) => d.id === value);
}
