import type { School } from '$lib/types/school';
import { normalizeText } from '$lib/utils';

/**
 * Free-text search over the school registry.
 *
 * Kept out of `$lib/server/data.ts` because that module imports the 27 MB CSV
 * with `?raw`: nothing that imports it can be unit-tested cheaply. The rules
 * below are the part worth testing, so they live in a module with no data in it.
 *
 * ## The rule
 *
 * The query is split on whitespace and **every** token must match, which is what
 * makes « blaise pascal 63 » narrower than « blaise pascal » rather than wider.
 * A token matches a school when either
 *
 * - the school's name or city contains it (accent- and case-insensitively), or
 * - the school's postal code *starts* with it.
 *
 * One rule for every token, with no attempt to classify « 63 » as a postal code
 * and « pascal » as a name. Letters never start a French postal code and digits
 * are rare in school names, so the disjunction sorts itself out — and where a
 * name genuinely does contain a number (« Groupe scolaire 8 Mai 1945 »), the
 * name branch still finds it instead of the token being hijacked as a location.
 *
 * `startsWith` on the postal code rather than `includes`, because a code is read
 * left to right: « 63 » means the Puy-de-Dôme, whereas `includes` would also
 * return 26630, 44163 and every other code with those digits somewhere in the
 * middle — putting back the noise the filter exists to remove.
 */

/**
 * Upper bound on the hits a search returns. A two-letter query matches a large
 * slice of a 64k-row registry, and the caller is a typeahead that only ever shows
 * a handful — so the cap is applied server-side, before the response is built.
 *
 * It lives here rather than in the endpoint because both ends need the number:
 * the API caps the response, and the typeahead has to tell « these are all of
 * them » apart from « these are the first ten of many » to know whether to ask
 * the user to narrow the query. Two copies would silently disagree.
 */
export const MAX_SEARCH_RESULTS = 10;

/** A school paired with the text its query tokens are matched against. */
export interface IndexedSchool {
  school: School;
  /** `name` and `city`, normalized once — see `buildSchoolSearchIndex`. */
  haystack: string;
}

/**
 * Normalize every school's searchable text up front.
 *
 * `normalizeText` allocates three strings per call (NFD, the regex replace, the
 * lowercase), and the typeahead searches all ~64k rows on every keystroke. Doing
 * it per query is ~200k throwaway strings a character typed; doing it once is a
 * table the process keeps. Build it beside the parsed registry and it costs
 * nothing after the first search.
 */
export function buildSchoolSearchIndex(schools: readonly School[]): IndexedSchool[] {
  return schools.map((school) => ({
    school,
    haystack: normalizeText(`${school.name} ${school.city}`),
  }));
}

/** The query's tokens, normalized and emptied of whitespace. */
function tokenize(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function matches(entry: IndexedSchool, tokens: string[]): boolean {
  return tokens.every(
    (token) => entry.haystack.includes(token) || entry.school.postalCode.startsWith(token)
  );
}

/**
 * The schools matching `query`, in registry order.
 *
 * An empty query returns everything, matching `searchDisciplines`: the caller
 * decides whether an unfiltered list is worth sending, and `/api/schools` does
 * that with its own `MAX_SEARCH_RESULTS` cap.
 */
export function searchSchoolIndex(index: readonly IndexedSchool[], query: string): School[] {
  const tokens = tokenize(query);

  if (tokens.length === 0) return index.map((entry) => entry.school);

  return index.filter((entry) => matches(entry, tokens)).map((entry) => entry.school);
}

/**
 * `searchSchoolIndex` over a plain array, for callers with no index to reuse.
 *
 * Only worth it for one-off searches over a small list — it normalizes every
 * school again on each call.
 */
export function searchSchools(schools: readonly School[], query: string): School[] {
  return searchSchoolIndex(buildSchoolSearchIndex(schools), query);
}
