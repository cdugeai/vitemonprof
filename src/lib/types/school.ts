import type { DepartementCode } from '$lib/departements';

export interface School {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  /**
   * The département or collectivité, in short form (`'75'`, `'2A'`, `'974'`).
   *
   * `null` only if the registry row carries neither a usable INSEE code nor a
   * usable postal code, which is true of no row in the current file.
   */
  departement: DepartementCode | null;
  latitude: number;
  longitude: number;
}
