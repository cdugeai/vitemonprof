import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { missedHourRepo } from '$lib/server/repo';
import { isClassGroup } from '$lib/classGroups';
import { isDiscipline } from '$lib/disciplines';
import { isClassLevel } from '$lib/classLevels';
import { checkDuplicateSubmission, checkRateLimit } from '$lib/server/rateLimit';
import { getSchoolsInfo } from '$lib/server/data';
import { isReportableDate } from '$lib/reportDate';

export const load: PageServerLoad = () => {
  // Returned as un-awaited promises so SvelteKit streams them: the page shell renders
  // immediately and the `{#await}` blocks fill in when each query lands.
  return {
    missed_hours: missedHourRepo.list(5),
    missed_hours_stats: missedHourRepo.stats(),
  };
};
export const actions = {
  default: async ({ request, getClientAddress, locals }) => {
    /**
     * Refuses the submission, and says so in the HTTP status as well as in the
     * body.
     *
     * `fail()` alone only reaches the client: the status it carries is read out
     * of the JSON body by `use:enhance`, and the response itself stays a 200 —
     * so every rejection is indistinguishable from a success in an access log.
     * `locals.actionStatus` is what `handleActionStatus` stamps on the response,
     * and threading it through one helper is what keeps the two from drifting:
     * there is a single `status` here, used for both.
     */
    const reject = (status: number, error: string) => {
      locals.actionStatus = status;
      return fail(status, { error });
    };

    if (request.method !== 'POST') {
      return reject(405, 'Méthode non autorisée.');
    }

    // Rate limit: max 5 requests per minute per IP
    const clientIp = getClientAddress();
    if (!checkRateLimit(clientIp)) {
      return reject(429, 'Trop de signalements coup sur coup. Merci de patienter une minute.');
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
      return reject(400, 'Veuillez choisir un établissement.');
    }

    if (!className) {
      return reject(400, 'Veuillez choisir une classe.');
    }

    if (!isClassLevel(String(className))) {
      return reject(400, 'Cette classe n’est pas reconnue.');
    }

    if (classGroup && !isClassGroup(String(classGroup))) {
      return reject(400, 'Le groupe doit être compris entre A et G (ou entre 1 et 7).');
    }

    // Optional like the group, and rejected the same way when present but bogus:
    // an id that is not in the mapping cannot be rendered back to a label, so
    // storing it would put a permanently unreadable row in the table.
    if (discipline && !isDiscipline(String(discipline))) {
      return reject(400, 'Cette matière n’est pas reconnue.');
    }

    if (!date) {
      return reject(400, 'Veuillez indiquer la date du cours.');
    }

    if (!isReportableDate(String(date))) {
      return reject(
        400,
        'La date doit être valide, ne pas être dans le futur et dater de moins d’un an.'
      );
    }

    const hoursNum = parseInt(String(nbHours), 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 4) {
      return reject(400, 'Le nombre d’heures doit être compris entre 1 et 4.');
    }

    // Everything above has been validated, which is why the duplicate check
    // waits until here: fingerprinting a report that is about to be rejected
    // anyway would fill the store with keys nothing can ever match.
    const report = {
      schoolId: String(schoolId),
      class: String(className),
      // The empty string is what a form sends for "nothing chosen"; the store only
      // speaks `null`, so the collapse happens here at the boundary.
      classGroup: isClassGroup(classGroup) ? classGroup : null,
      discipline: isDiscipline(discipline) ? discipline : null,
      date_: String(date),
      nbHours: hoursNum,
    };

    // The burst limit at the top of this action and this check guard different
    // mistakes. Five submissions a minute is a *volume* the site allows on
    // purpose — someone filing a week of absences in one sitting — so a batch of
    // five *different* reports has to go through. The same report twice is a
    // double-tapped button or a replayed form, and no legitimate flow produces
    // it.
    if (!checkDuplicateSubmission(clientIp, report)) {
      return reject(429, 'Vous avez déjà effectué ce signalement.');
    }

    // Resolved here, from the registry, rather than taken from the form. The
    // client has no business asserting which département a school is in: it is a
    // fact about the school, the server already knows it, and accepting it from
    // a POST would let anyone file reports into a département of their choosing
    // and skew the dashboard. Unknown school ids resolve to `null`, which every
    // département-scoped query then excludes.
    const school = getSchoolsInfo([String(schoolId)]).get(String(schoolId));

    // No id: `missed_hour.id` is a sequence now, so the store assigns it. The
    // action never needed to know it — it answers with a redirect, not with the
    // row — which is what made the client-generated UUID safe to drop.
    await missedHourRepo.add({
      ...report,
      departement: school?.departement ?? null,
      createdAt: new Date().toISOString(),
    });

    // 201 Created, for the enhanced path only. `use:enhance` fetches this
    // endpoint and reads the outcome out of the JSON body, so SvelteKit answers
    // it 200 and the redirect below never becomes a real one — 201 is what that
    // response actually is, a receipt for a row that now exists. A browser
    // without JS follows the 303 for real and is left alone, because
    // `handleActionStatus` only ever overwrites a 200. Two success codes in the
    // log, then, and they say which client sent the report.
    locals.actionStatus = 201;

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
