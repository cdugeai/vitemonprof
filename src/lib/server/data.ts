import type { School } from '$lib/types/school';
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
 * Lowercase and strip diacritics so "Vitré" and "VITRE" are the same needle.
 * NFD splits "é" into "e" + combining accent; the regex then drops the accent.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Schools whose name or postal code contains `query_string` (case/accent-insensitive). */
export function getSchoolsFilterName(query_string: string): School[] {
  const needle = normalize(query_string.trim());

  if (needle === '') {
    return getSchools();
  }

  return getSchools().filter(
    (sc) => normalize(sc.name).includes(needle) || sc.postalCode.includes(needle)
  );
}
