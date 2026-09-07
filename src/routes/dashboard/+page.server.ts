import { missedHourRepo } from '$lib/server/repo';
import { TOP_LIMIT } from '$lib/server/repo/types';
import { departementLabel, isDepartement } from '$lib/departements';
import { disciplineLabel, isDiscipline } from '$lib/disciplines';
import type { TopDimension } from '$lib/types/missedHours';
import type { PageServerLoad } from './$types';

/** One ranked entry, already carrying everything the page needs to render it. */
export interface RankedEntry {
  key: string;
  label: string;
  totalHours: number;
  /** Distinct missed hours — not how many people reported them. */
  events: number;
  /** Reports behind those events, so corroboration stays visible. */
  submissions: number;
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
 *
 * The two parameters are not independent, and that is deliberate rather than
 * accidental: the dropdown is a *scope*, and it narrows whichever ranking the
 * toggle asks for. With `dimension=departement` and a département selected, the
 * ranking is the one row describing that zone — which is what "only show the
 * stats of this zone" asks for, expressed as a filter rather than as a fourth
 * page state.
 */
export const load: PageServerLoad = ({ url }) => {
  const requestedDepartement = url.searchParams.get('departement');
  const departement = isDepartement(requestedDepartement) ? requestedDepartement : null;

  const dimension: TopDimension =
    url.searchParams.get('dimension') === 'discipline' ? 'discipline' : 'departement';

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
 * The repo deals in opaque keys — a département code, a discipline id — because
 * the labels live in lookup tables that storage has no business knowing about.
 * Both of those tables are small, static and already shipped to the browser, so
 * unlike the school registry this could equally happen in the component; it
 * stays here so the page renders one shape and has no reason to know which
 * dimension produced it.
 */
async function rank(departement: string | null, dimension: TopDimension): Promise<RankedEntry[]> {
  const rows = await missedHourRepo.top({ departement, dimension, limit: TOP_LIMIT });

  // Both labellers are guarded rather than cast: `discipline` and `departement`
  // are plain `text` columns, so a row written by an older version — or by hand
  // — can hold anything. The bare code rather than an empty line when they do:
  // the number is still true, and hiding the row would make the totals not add
  // up.
  const label =
    dimension === 'discipline'
      ? (key: string) => (isDiscipline(key) ? disciplineLabel(key) : key)
      : departementLabel;

  return rows.map((row) => ({ ...row, label: label(row.key) }));
}
