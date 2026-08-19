import type { School } from '$lib/types/school';
import { normalizeText } from '$lib/utils';
import csvContent from '../../../data/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre-sample100.csv?raw';

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

      return {
        id: cells[headerMap.get("Numéro d'UAI") ?? -1]?.trim() || '',
        name: cells[headerMap.get('Appellation officielle') ?? -1]?.trim() || '',
        address: cells[headerMap.get('Adresse : désignation de la voie') ?? -1]?.trim() || '',
        city: cells[headerMap.get("Localité d'acheminement") ?? -1]?.trim() || '',
        postalCode: cells[headerMap.get('Adresse : code postal') ?? -1]?.trim() || '',
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
