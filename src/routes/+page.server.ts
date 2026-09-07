import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { missedHourRepo } from '$lib/server/repo';
import { isClassGroup } from '$lib/classGroups';
import { isDiscipline } from '$lib/disciplines';
import { isClassLevel } from '$lib/classLevels';
import { randomUUID } from 'crypto';

/**
 * `YYYY-MM-DD` and a genuine calendar date — `2026-02-31` matches the shape but
 * isn't a day, and `Date.parse` would quietly roll it over to March 3rd.
 * Round-tripping through ISO catches that.
 *
 * The `date` column would reject bad input anyway, but a driver error surfaces as a
 * 500; validating here gives the user a 400 and a message they can act on.
 */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export const load: PageServerLoad = () => {
  // Returned as un-awaited promises so SvelteKit streams them: the page shell renders
  // immediately and the `{#await}` blocks fill in when each query lands.
  return {
    missed_hours: missedHourRepo.list(),
    missed_hours_stats: missedHourRepo.stats(),
  };
};
export const actions = {
  default: async ({ request }) => {
    if (request.method !== 'POST') {
      return fail(405, { error: 'Method not allowed' });
    }

    const formData = await request.formData();

    const schoolId = formData.get('schoolId');
    const className = formData.get('class');
    const classGroup = formData.get('classGroup');
    const discipline = formData.get('discipline');
    const date = formData.get('date');
    const nbHours = formData.get('nbHours');

    // Validation
    if (!schoolId) {
      return fail(400, { error: 'School is required' });
    }

    if (!className) {
      return fail(400, { error: 'Class is required' });
    }

    if (!isClassLevel(String(className))) {
      return fail(400, { error: 'Unknown class' });
    }

    if (classGroup && !isClassGroup(String(classGroup))) {
      return fail(400, { error: 'Class group must be one of A-G (or 1-7)' });
    }

    // Optional like the group, and rejected the same way when present but bogus:
    // an id that is not in the mapping cannot be rendered back to a label, so
    // storing it would put a permanently unreadable row in the table.
    if (discipline && !isDiscipline(String(discipline))) {
      return fail(400, { error: 'Unknown discipline' });
    }

    if (!date) {
      return fail(400, { error: 'Date is required' });
    }

    if (!isCalendarDate(String(date))) {
      return fail(400, { error: 'Date must be a valid calendar date (YYYY-MM-DD)' });
    }

    const hoursNum = parseInt(String(nbHours), 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 4) {
      return fail(400, { error: 'Hours must be between 1 and 4' });
    }

    // The store never invents an id: generating it here means the caller knows what it
    // wrote without a round trip, and every backend behaves the same way.
    await missedHourRepo.add({
      uuid: randomUUID(),
      schoolId: String(schoolId),
      class: String(className),
      // The empty string is what a form sends for "nothing chosen"; the store only
      // speaks `null`, so the collapse happens here at the boundary.
      classGroup: isClassGroup(classGroup) ? classGroup : null,
      discipline: isDiscipline(discipline) ? discipline : null,
      date_: String(date),
      nbHours: hoursNum,
      createdAt: new Date().toISOString(),
    });

    // Post/Redirect/Get: answer the POST with a 303 rather than HTML. Without it the
    // browser's history entry for `/` stays a POST, so a refresh replays the submission
    // ("Confirm Form Resubmission") and inserts the report a second time. The 303 turns
    // that entry into a plain GET, which is safe to reload as many times as you like.
    //
    // The redirect discards the action's return value, so `form` is null on the next
    // render and can't carry the confirmation. `?submitted` is the flash instead: it
    // survives the redirect and works with or without JS. The page scrubs it from the
    // URL once it has been read.
    redirect(303, '/?submitted');
  },
} satisfies Actions;
