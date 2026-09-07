import { error, json } from '@sveltejs/kit';
import { getSchools } from '$lib/server/data';
import { getSchoolsInfo } from '$lib/server/db_tmp';
import type { RequestHandler } from './$types';

/** Upper bound on `?id=` filters, so a crafted URL can't force an oversized response. */
const MAX_IDS = 50;

/**
 * GET /api/schools            -> every school
 * GET /api/schools?id=a&id=b  -> just those schools (unknown ids are skipped)
 */
export const GET: RequestHandler = async ({ url }) => {
  const ids = url.searchParams.getAll('id');

  if (ids.length === 0) {
    return json(getSchools());
  }

  if (ids.length > MAX_IDS) {
    error(400, `Too many ids: ${ids.length} (max ${MAX_IDS})`);
  }

  const schools = await getSchoolsInfo(ids);

  // A Map has no JSON representation — send an array and let the caller re-index it.
  return json([...schools.values()]);
};
