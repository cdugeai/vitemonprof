import { error } from '@sveltejs/kit';
import { MAX_SEARCH_RESULTS } from '$lib/schoolSearch';
import { getSchools, getSchoolsInfo, searchSchools } from '$lib/server/data';
import { gzipJson, gzipJsonResponse } from '$lib/server/gzip-json';
import type { School } from '$lib/types/school';
import type { RequestHandler } from './$types';

/** Upper bound on `?id=` filters, so a crafted URL can't force an oversized response. */
const MAX_IDS = 50;

/**
 * Coordinate precision on the wire. A fifth decimal of latitude is ~1.1 m — finer than
 * a school building, let alone a map marker — and the CSV's raw values run to 15 digits
 * of float noise, which is both incompressible and useless.
 *
 * Rounding rather than truncating: same digit count, half the worst-case error (~0.55 m)
 * and no systematic drift toward the equator. Trailing zeros vanish in `JSON.stringify`,
 * so `49.51320` ships as `49.5132`.
 */
const COORD_DECIMALS = 5;
const COORD_SCALE = 10 ** COORD_DECIMALS;

function roundCoord(value: number): number {
  return Math.round(value * COORD_SCALE) / COORD_SCALE;
}

/**
 * Copy each school with its coordinates rounded.
 *
 * Non-destructive on purpose: `getSchools()` hands back its memoized array, so mutating
 * these objects would quietly round the cache — fine once, but it makes the cached data
 * depend on which endpoint happened to touch it first.
 */
function withRoundedCoords(schools: School[]): School[] {
  return schools.map((school) => ({
    ...school,
    latitude: roundCoord(school.latitude),
    longitude: roundCoord(school.longitude),
  }));
}

/**
 * The full registry gzipped once, on first request.
 *
 * The uncompressed JSON is tens of megabytes and identical for every caller, so both
 * the `JSON.stringify` and the deflate are pure waste after the first time — the same
 * reasoning that makes `getSchools()` memoize its parse. The filtered branches below
 * are small and caller-specific, so they compress per request.
 */
let cachedAllSchoolsGzip: Uint8Array<ArrayBuffer> | null = null;

function allSchoolsGzip(): Uint8Array<ArrayBuffer> {
  cachedAllSchoolsGzip ??= gzipJson(withRoundedCoords(getSchools()));

  return cachedAllSchoolsGzip;
}

/**
 * GET /api/schools                 -> every school
 * GET /api/schools?id=a&id=b       -> just those schools (unknown ids are skipped)
 * GET /api/schools?query_string=x  -> schools matching every word of `x` (see
 *                                     `$lib/schoolSearch` for what a word matches)
 *
 * `id` takes precedence over `query_string` if both are supplied.
 *
 * Every response is gzipped JSON (`application/gzip`), not JSON — callers inflate it
 * with `fetchGzipJson` from `$lib/gzip-json`.
 */
export const GET: RequestHandler = async ({ url }) => {
  const ids = url.searchParams.getAll('id');
  const queryString = url.searchParams.get('query_string')?.trim() ?? '';

  if (ids.length > 0) {
    if (ids.length > MAX_IDS) {
      error(400, `Too many ids: ${ids.length} (max ${MAX_IDS})`);
    }

    const schools = getSchoolsInfo(ids);

    // A Map has no JSON representation — send an array and let the caller re-index it.
    return gzipJsonResponse(gzipJson(withRoundedCoords([...schools.values()])));
  }

  if (queryString) {
    return gzipJsonResponse(
      gzipJson(withRoundedCoords(searchSchools(queryString).slice(0, MAX_SEARCH_RESULTS)))
    );
  }

  return gzipJsonResponse(allSchoolsGzip());
};
