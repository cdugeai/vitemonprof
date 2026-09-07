import { missedHourRepo } from '$lib/server/repo';
import { TOP_LIMIT } from '$lib/server/repo/types';
import { getSchoolsInfo } from '$lib/server/data';
import { isDepartement } from '$lib/departements';
import { disciplineLabel, isDiscipline } from '$lib/disciplines';
import type { TopDimension } from '$lib/types/missedHours';
import type { PageServerLoad } from './$types';

/** One ranked entry, already carrying everything the page needs to render it. */
export interface RankedEntry {
  key: string;
  label: string;
  /** Secondary line — a school's town, or nothing for a discipline. */
  sublabel: string | null;
  totalHours: number;
  reportCount: number;
}

/**
 * The dashboard's state lives in the URL, not in component state.
 *
 * Three things fall out of that for free: the view is linkable ("look at 93"),
 * the back button steps through previous selections, and the page renders
 * correctly on a cold server request — none of which is true of a `$state` in
 * the component. The selectors below just navigate.
 *
 * Both parameters are validated rather than trusted. `departement` reaches a SQL
 * `where` (as a bound parameter, but still), and `dimension` chooses a `group by`
 * column, so an unrecognised value has to become a default here rather than
 * travel further in.
 */
export const load: PageServerLoad = ({ url }) => {
  const requestedDepartement = url.searchParams.get('departement');
  const departement = isDepartement(requestedDepartement) ? requestedDepartement : null;

  const dimension: TopDimension =
    url.searchParams.get('dimension') === 'discipline' ? 'discipline' : 'school';

  return {
    departement,
    dimension,
    // Un-awaited, like the homepage's queries: SvelteKit streams it, so the
    // shell and both selectors render immediately and only the ranking waits.
    ranking: rank(departement, dimension),
  };
};

/**
 * Ranks, then labels.
 *
 * The repo deals in opaque keys — a UAI code, a discipline id — because the
 * labels live in a CSV and a lookup table that storage has no business knowing
 * about. Resolving them here rather than in the component keeps the school
 * registry on the server, where it already is: the alternative is shipping five
 * more ids to the browser so it can make five more requests to `/api/schools`.
 */
async function rank(departement: string | null, dimension: TopDimension): Promise<RankedEntry[]> {
  const rows = await missedHourRepo.top({ departement, dimension, limit: TOP_LIMIT });

  if (dimension === 'discipline') {
    return rows.map((row) => ({
      ...row,
      // Guarded, not cast: `discipline` is a plain `text` column, so a row
      // written by an older version — or by hand — can hold anything.
      label: isDiscipline(row.key) ? disciplineLabel(row.key) : row.key,
      sublabel: null,
    }));
  }

  const schools = getSchoolsInfo(rows.map((row) => row.key));

  return rows.map((row) => {
    const school = schools.get(row.key);

    return {
      ...row,
      // The bare UAI code rather than an empty line when a report names a school
      // the registry does not have — the number is still true, and hiding the
      // row would make the totals not add up.
      label: school?.name ?? row.key,
      sublabel: school ? `${school.postalCode} ${school.city}` : null,
    };
  });
}
