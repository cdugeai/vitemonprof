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
import { normalizeText } from '$lib/utils';

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

/** `'hggsp'` → the full human label. Falls back to the id so an unknown value is
 * still visible in the UI rather than rendering as a blank. */
export function disciplineLabel(id: Discipline): string {
  return DISCIPLINES.find((d) => d.id === id)?.label ?? id;
}

/**
 * Disciplines matching a free-text query, in declaration order.
 *
 * Two rules, each earning its place:
 * - **Accent- and case-insensitive**, via the same `normalizeText` the school
 *   search uses. Typing "francais" has to find « Français »; a French search box
 *   that demands accents is one people give up on.
 * - **`note` is searched alongside `label`.** No entry carries a note today, but
 *   the field exists for options that bundle several real subjects — give *Arts*
 *   a note of "musique, théâtre, cirque" and those words become findable without
 *   splitting it into separate entries.
 *
 * An empty query returns everything: the list is local, so there is no round trip
 * to protect and the dropdown should open showing the full menu, then narrow.
 *
 * Lives here rather than in the component so the rules are one testable function
 * instead of an expression buried in a template.
 */
export function searchDisciplines(query: string): readonly DisciplineOption[] {
  // `as const` on DISCIPLINES gives every entry its own exact literal type, so an
  // entry without a `note` genuinely lacks the property and the union has no
  // common `note` to read — `d.note` will not compile off the raw array. Widening
  // to `DisciplineOption[]` restores the uniform `note?: string` shape, while
  // `Discipline` stays derived from the raw array and keeps its narrow union of
  // ids. Precision where it protects the data, ergonomics where it only reads.
  const all: readonly DisciplineOption[] = DISCIPLINES;
  const needle = normalizeText(query.trim());

  if (needle === '') return all;

  return all.filter((d) => normalizeText(`${d.label} ${d.note ?? ''}`).includes(needle));
}

/** Same role as `isClassGroup`: the guard used on both edges — untrusted POST
 * data on the way in, and `text` columns on the way out. */
export function isDiscipline(value: unknown): value is Discipline {
  return typeof value === 'string' && DISCIPLINES.some((d) => d.id === value);
}
