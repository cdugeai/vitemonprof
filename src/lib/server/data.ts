import { readFileSync } from 'fs';
import { join } from 'path';
import type { School } from '$lib/types/school';

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
    const csvPath = join(process.cwd(), 'data/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre-sample100.csv');
    const content = readFileSync(csvPath, 'utf-8');
    cachedSchools = parseCSV(content);
  }

  return cachedSchools;
}
