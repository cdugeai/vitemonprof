/**
 * The French départements and overseas collectivités, and how to recover one
 * from a postal code.
 *
 * The list is not decoration: it is the vocabulary the dashboard filters on and
 * the set a stored `departement` is validated against. It was generated from the
 * national school registry's own `Code INSEE du département ou de la
 * collectivité` column, so it covers every value that can actually appear in the
 * data — including the six collectivités an "01 to 95 plus the DOM" list quietly
 * drops (975, 977, 978, 986, 987, 988), which between them hold 731 schools.
 */
export interface Departement {
  /** The usual short form: `'01'`, `'2A'`, `'971'`. Never zero-padded to three. */
  readonly code: string;
  readonly name: string;
}

export const DEPARTEMENTS: readonly Departement[] = [
  { code: '01', name: 'Ain' },
  { code: '02', name: 'Aisne' },
  { code: '03', name: 'Allier' },
  { code: '04', name: 'Alpes-de-Haute-Provence' },
  { code: '05', name: 'Hautes-Alpes' },
  { code: '06', name: 'Alpes-Maritimes' },
  { code: '07', name: 'Ardèche' },
  { code: '08', name: 'Ardennes' },
  { code: '09', name: 'Ariège' },
  { code: '10', name: 'Aube' },
  { code: '11', name: 'Aude' },
  { code: '12', name: 'Aveyron' },
  { code: '13', name: 'Bouches-du-Rhône' },
  { code: '14', name: 'Calvados' },
  { code: '15', name: 'Cantal' },
  { code: '16', name: 'Charente' },
  { code: '17', name: 'Charente-Maritime' },
  { code: '18', name: 'Cher' },
  { code: '19', name: 'Corrèze' },
  { code: '21', name: "Côte-d'Or" },
  { code: '22', name: "Côtes-d'Armor" },
  { code: '23', name: 'Creuse' },
  { code: '24', name: 'Dordogne' },
  { code: '25', name: 'Doubs' },
  { code: '26', name: 'Drôme' },
  { code: '27', name: 'Eure' },
  { code: '28', name: 'Eure-et-Loir' },
  { code: '29', name: 'Finistère' },
  { code: '2A', name: 'Corse-du-Sud' },
  { code: '2B', name: 'Haute-Corse' },
  { code: '30', name: 'Gard' },
  { code: '31', name: 'Haute-Garonne' },
  { code: '32', name: 'Gers' },
  { code: '33', name: 'Gironde' },
  { code: '34', name: 'Hérault' },
  { code: '35', name: 'Ille-et-Vilaine' },
  { code: '36', name: 'Indre' },
  { code: '37', name: 'Indre-et-Loire' },
  { code: '38', name: 'Isère' },
  { code: '39', name: 'Jura' },
  { code: '40', name: 'Landes' },
  { code: '41', name: 'Loir-et-Cher' },
  { code: '42', name: 'Loire' },
  { code: '43', name: 'Haute-Loire' },
  { code: '44', name: 'Loire-Atlantique' },
  { code: '45', name: 'Loiret' },
  { code: '46', name: 'Lot' },
  { code: '47', name: 'Lot-et-Garonne' },
  { code: '48', name: 'Lozère' },
  { code: '49', name: 'Maine-et-Loire' },
  { code: '50', name: 'Manche' },
  { code: '51', name: 'Marne' },
  { code: '52', name: 'Haute-Marne' },
  { code: '53', name: 'Mayenne' },
  { code: '54', name: 'Meurthe-et-Moselle' },
  { code: '55', name: 'Meuse' },
  { code: '56', name: 'Morbihan' },
  { code: '57', name: 'Moselle' },
  { code: '58', name: 'Nièvre' },
  { code: '59', name: 'Nord' },
  { code: '60', name: 'Oise' },
  { code: '61', name: 'Orne' },
  { code: '62', name: 'Pas-de-Calais' },
  { code: '63', name: 'Puy-de-Dôme' },
  { code: '64', name: 'Pyrénées-Atlantiques' },
  { code: '65', name: 'Hautes-Pyrénées' },
  { code: '66', name: 'Pyrénées-Orientales' },
  { code: '67', name: 'Bas-Rhin' },
  { code: '68', name: 'Haut-Rhin' },
  { code: '69', name: 'Rhône' },
  { code: '70', name: 'Haute-Saône' },
  { code: '71', name: 'Saône-et-Loire' },
  { code: '72', name: 'Sarthe' },
  { code: '73', name: 'Savoie' },
  { code: '74', name: 'Haute-Savoie' },
  { code: '75', name: 'Paris' },
  { code: '76', name: 'Seine-Maritime' },
  { code: '77', name: 'Seine-et-Marne' },
  { code: '78', name: 'Yvelines' },
  { code: '79', name: 'Deux-Sèvres' },
  { code: '80', name: 'Somme' },
  { code: '81', name: 'Tarn' },
  { code: '82', name: 'Tarn-et-Garonne' },
  { code: '83', name: 'Var' },
  { code: '84', name: 'Vaucluse' },
  { code: '85', name: 'Vendée' },
  { code: '86', name: 'Vienne' },
  { code: '87', name: 'Haute-Vienne' },
  { code: '88', name: 'Vosges' },
  { code: '89', name: 'Yonne' },
  { code: '90', name: 'Territoire de Belfort' },
  { code: '91', name: 'Essonne' },
  { code: '92', name: 'Hauts-de-Seine' },
  { code: '93', name: 'Seine-Saint-Denis' },
  { code: '94', name: 'Val-de-Marne' },
  { code: '95', name: "Val-d'Oise" },
  { code: '971', name: 'Guadeloupe' },
  { code: '972', name: 'Martinique' },
  { code: '973', name: 'Guyane' },
  { code: '974', name: 'La Réunion' },
  { code: '975', name: 'St-Pierre-et-Miquelon' },
  { code: '976', name: 'Mayotte' },
  { code: '977', name: 'Saint-Barthélémy' },
  { code: '978', name: 'Saint-Martin' },
  { code: '986', name: 'Wallis et Futuna' },
  { code: '987', name: 'Polynésie Française' },
  { code: '988', name: 'Nouvelle Calédonie' },
];

export type DepartementCode = (typeof DEPARTEMENTS)[number]['code'];

const BY_CODE = new Map(DEPARTEMENTS.map((d) => [d.code, d]));

/** Whether `value` is a code this app recognises. Narrows unknown form/URL input. */
export function isDepartement(value: unknown): value is DepartementCode {
  return typeof value === 'string' && BY_CODE.has(value);
}

/** `'2A'` -> `'2A - Corse-du-Sud'`. Falls back to the bare code for anything unknown. */
export function departementLabel(code: string): string {
  const found = BY_CODE.get(code);

  return found ? `${found.code} - ${found.name}` : code;
}

/**
 * The registry's INSEE spelling (`'001'`, `'02A'`) in this module's spelling
 * (`'01'`, `'2A'`).
 *
 * This is the **authoritative** route: the column is filled on all 63,985 rows
 * of the registry and is right about Corsica, which no postal-code rule can be —
 * see `departementFromPostalCode`.
 */
export function departementFromInsee(insee: string): DepartementCode | null {
  const trimmed = insee.trim();
  // Metropolitan codes are zero-padded to three (`001`, `02A`); the overseas
  // ones (`971`) already are three characters and must not be touched.
  const code = trimmed.length === 3 && trimmed.startsWith('0') ? trimmed.slice(1) : trimmed;

  return isDepartement(code) ? code : null;
}

/**
 * Postal codes that do not name the collectivité they belong to.
 *
 * Verified against the registry's INSEE column, these are every code where the
 * three-digit rule below lands somewhere else — all of them in the Antilles,
 * where Saint-Barthélemy and Saint-Martin were carved out of Guadeloupe in 2007
 * and kept the postal codes they already had.
 *
 * The `970xx` pair are CEDEX codes, which the three-digit rule cannot even guess
 * at: `970` is not a département, so without this map they return `null`.
 */
const OVERSEAS_POSTAL_OVERRIDES = new Map<string, string>([
  ['97095', '977'], // Saint-Barthélemy (CEDEX)
  ['97133', '977'], // Saint-Barthélemy — Gustavia
  ['97052', '978'], // Saint-Martin (CEDEX)
  ['97150', '978'], // Saint-Martin — Marigot
]);

/**
 * The département a postal code sits in.
 *
 * French postal codes only *usually* start with their département, so this is
 * four rules deep:
 *
 * - **Known exceptions first** — `OVERSEAS_POSTAL_OVERRIDES`. `97150` is
 *   Saint-Martin and `97133` is Saint-Barthélemy, even though both sit inside
 *   Guadeloupe's `971xx` block.
 * - **`978xx` is La Réunion**, not Saint-Martin. Those are La Réunion's CEDEX
 *   codes, and they read as `978` under a naive three-digit rule.
 * - **`97xxx` / `98xxx` — three digits, not two.** `97400` is `974`
 *   (La Réunion), `98800` is `988` (Nouvelle-Calédonie). This reproduces every
 *   published range: 97100-97190 → `971`, 97200-97290 → `972`, 97300-97390 →
 *   `973`, 97400-97490 → `974`, 97600+ → `976`.
 * - **`20xxx` — Corsica.** The département is `2A` or `2B`, which appears in no
 *   postal code at all. Below `20200` is Corse-du-Sud, from `20200` up is
 *   Haute-Corse.
 * - **Everything else** — the first two digits.
 *
 * Returns `null` for anything that is not five digits or does not land on a real
 * département.
 *
 * **Corsica remains inexact, and cannot be made exact.** Corsican postal codes
 * interleave across the two départements: measured against the registry's own
 * INSEE column, `20537` and `20700` are Corse-du-Sud while the `20200`-and-up
 * rule calls them Haute-Corse. No prefix rule can fix that, because the two
 * départements genuinely share prefixes. A handful of métropole codes also
 * straddle a border, because the post office routes by delivery office rather
 * than by administrative boundary. `departementFromInsee` is exact and is what
 * the school registry actually uses; this function is the fallback for a school
 * whose INSEE code is unusable.
 */
export function departementFromPostalCode(postalCode: string): DepartementCode | null {
  const digits = postalCode.trim();

  if (!/^\d{5}$/.test(digits)) return null;

  const code = overseasOrNull(digits) ?? corsicaOrNull(digits) ?? digits.slice(0, 2);

  return isDepartement(code) ? code : null;
}

/** `20xxx` -> `2A` / `2B`; anything else -> `null`, so the caller falls through. */
function corsicaOrNull(digits: string): string | null {
  if (!digits.startsWith('20')) return null;

  return Number(digits) < 20200 ? '2A' : '2B';
}

/** `97xxx` / `98xxx` -> the three-digit collectivité code, exceptions first. */
function overseasOrNull(digits: string): string | null {
  const override = OVERSEAS_POSTAL_OVERRIDES.get(digits);
  if (override) return override;

  // Checked before the generic three-digit slice, which would read these as
  // Saint-Martin.
  if (digits.startsWith('978')) return '974';

  return digits.startsWith('97') || digits.startsWith('98') ? digits.slice(0, 3) : null;
}
