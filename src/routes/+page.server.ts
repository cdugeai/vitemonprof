import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addMissedHour, computeStats, getMissedHour } from '$lib/server/db_tmp';
import { randomUUID } from 'crypto';

export const load: PageServerLoad = () => {
  return {
    missed_hours: getMissedHour(),
    missed_hours_stats: computeStats(),
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
    const date = formData.get('date');
    const nbHours = formData.get('nbHours');
    const dept = formData.get('dept');
    const school_name = formData.get('school_name');

    // Validation
    if (!schoolId) {
      return fail(400, { error: 'School is required' });
    }

    if (!className || className === 'none') {
      return fail(400, { error: 'Class is required' });
    }

    if (!date) {
      return fail(400, { error: 'Date is required' });
    }

    const hoursNum = parseInt(String(nbHours), 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 4) {
      return fail(400, { error: 'Hours must be between 1 and 4' });
    }

    // TODO: Save the data to your database or state management
    // This is where you'd handle the actual submission
    const entry = {
      schoolId,
      class: className,
      date,
      nbHours: hoursNum,
      createdAt: new Date().toISOString(),
      dept,
      school_name,
    };

    console.log('Form submitted:', entry);

    await addMissedHour({
      uuid: randomUUID().toString(),
      class: entry.class.toString(),
      date_: entry.date.toString(),
      createdAt: entry.createdAt.toString(),
      nbHours: entry.nbHours.valueOf() as number,
      schoolId: entry.schoolId.toString(),
    });

    // Post/Redirect/Get: answer the POST with a 303 rather than HTML. Without it the
    // browser's history entry for `/` stays a POST, so a refresh replays the submission
    // ("Confirm Form Resubmission") and inserts the report a second time. The 303 turns
    // that entry into a plain GET, which is safe to reload as many times as you like.
    redirect(303, '/');
  },
} satisfies Actions;
