import { departementFromInsee, departementFromPostalCode } from '$lib/departements';
import type { School } from '$lib/types/school';
import { normalizeText } from '$lib/utils';
import { isMaternelle } from './schoolKind';
import csvContent from '../../../data/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre.csv?raw';

let cachedSchools: School[] | null = null;

function parseCSV(content: string): School[] {
  const lines = content.split('\n');
  const headers = lines[0].split(';');

  const headerMap = new Map(headers.map((h, i) => [h.trim(), i]));

  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const cells = line.split(';');

      const latitude = parseFloat(cells[headerMap.get('Latitude WGS84') ?? -1] || '0');
      const longitude = parseFloat(cells[headerMap.get('Longitude WGS84') ?? -1] || '0');

      // Only include schools with valid coordinates
      if (!latitude || !longitude) {
        return null;
      }

      const name = cells[headerMap.get('Appellation officielle') ?? -1]?.trim() || '';
      const natureCode = cells[headerMap.get("Code nature de l'UAI") ?? -1]?.trim() || '';

      // Maternelles are out of scope: this app is about missed *lessons*, and
      // the children in a maternelle are too young for the question to mean the
      // same thing. Dropped at the parse, so every consumer — the typeahead, the
      // map, `/api/schools` — inherits it without having to remember.
      if (isMaternelle({ natureCode, name })) {
        return null;
      }

      const postalCode = cells[headerMap.get('Adresse : code postal') ?? -1]?.trim() || '';
      const insee =
        cells[headerMap.get('Code INSEE du département ou de la collectivité') ?? -1]?.trim() || '';

      return {
        id: cells[headerMap.get("Numéro d'UAI") ?? -1]?.trim() || '',
        name,
        address: cells[headerMap.get('Adresse : désignation de la voie') ?? -1]?.trim() || '',
        city: cells[headerMap.get("Localité d'acheminement") ?? -1]?.trim() || '',
        postalCode,
        // INSEE first, postal code only as a fallback. Measured over the whole
        // 63,985-row file, the postal rule disagrees with the INSEE column on 84
        // schools — and not randomly: `97150` is Saint-Martin and `97133` is
        // Saint-Barthélemy despite sitting inside Guadeloupe's range, La
        // Réunion's CEDEX codes run `978xx` which looks like Saint-Martin, and a
        // handful of métropole codes straddle a border because the post office
        // routes by delivery office rather than by département. The registry
        // states the answer outright, so guessing it would be a choice.
        departement: departementFromInsee(insee) ?? departementFromPostalCode(postalCode),
        latitude,
        longitude,
      };
    })
    .filter((school) => school !== null) as School[];
}

export function getSchools(): School[] {
  if (cachedSchools === null) {
    cachedSchools = parseCSV(csvContent);
  }

  return cachedSchools;
}

/**
 * Look up a set of schools by UAI code.
 *
 * Lives here rather than behind `MissedHourRepo` because schools aren't in the
 * database at all — they're parsed from the CSV above. Giving CSV data a
 * repository interface would be abstraction with nothing to abstract over; if the
 * registry ever moves into Postgres, *that's* when it earns its own port.
 *
 * Returns a Map so callers can index by id without re-scanning. Unknown ids are
 * simply absent — a bad id in a query string isn't an error worth failing on.
 */
export function getSchoolsInfo(school_ids: string[]): Map<string, School> {
  const wanted = new Set(school_ids);

  return new Map(
    getSchools()
      .filter((s) => wanted.has(s.id))
      .map((s) => [s.id, s])
  );
}

/** Schools whose name or postal code contains `query_string` (case/accent-insensitive). */
export function getSchoolsFilterName(query_string: string): School[] {
  const needle = normalizeText(query_string.trim());

  if (needle === '') {
    return getSchools();
  }

  return getSchools().filter(
    (sc) => normalizeText(sc.name).includes(needle) || sc.postalCode.includes(needle)
  );
}
