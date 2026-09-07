import { error } from '@sveltejs/kit';
import { getSchools, getSchoolsFilterName, getSchoolsInfo } from '$lib/server/data';
import { gzipJson, gzipJsonResponse } from '$lib/server/gzip-json';
import type { RequestHandler } from './$types';

/** Upper bound on `?id=` filters, so a crafted URL can't force an oversized response. */
const MAX_IDS = 50;

/**
 * Upper bound on search hits. A one-letter query matches most of the dataset, and the
 * caller is a typeahead that only ever shows a handful — so cap it server-side.
 */
const MAX_SEARCH_RESULTS = 10;

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
  cachedAllSchoolsGzip ??= gzipJson(getSchools());

  return cachedAllSchoolsGzip;
}

/**
 * GET /api/schools                 -> every school
 * GET /api/schools?id=a&id=b       -> just those schools (unknown ids are skipped)
 * GET /api/schools?query_string=x  -> schools whose name or postal code contains `x`
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
    return gzipJsonResponse(gzipJson([...schools.values()]));
  }

  if (queryString) {
    return gzipJsonResponse(
      gzipJson(getSchoolsFilterName(queryString).slice(0, MAX_SEARCH_RESULTS))
    );
  }

  return gzipJsonResponse(allSchoolsGzip());
};
