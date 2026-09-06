import { expect, test, type APIRequestContext } from '@playwright/test';
import { resetRateLimit } from './support/rate-limit';

/**
 * The status code a submission answers with, for both kinds of client.
 *
 * These are the only assertions in the suite that exist for the *log* rather
 * than for the user: nothing on screen changes if `POST /` goes back to
 * answering 200 for everything, which is exactly why it needs pinning here.
 *
 * The two paths are told apart by `accept` alone, and that is not a detail this
 * spec invents — it is how SvelteKit routes an action request. `use:enhance`
 * asks for `application/json` and gets the outcome as a JSON body; a browser
 * with no JS asks for `text/html` and gets a page or a redirect.
 */
const ENHANCED = { accept: 'application/json', 'x-sveltekit-action': 'true' };
const NO_JS = { accept: 'text/html,application/xhtml+xml' };

function submit(
  request: APIRequestContext,
  headers: Record<string, string>,
  fields: Record<string, string>
) {
  return request.post('/', {
    headers,
    form: fields,
    // Otherwise Playwright follows the 303 and reports the status of `/`,
    // which is a 200 whatever happened here.
    maxRedirects: 0,
  });
}

const VALID = { schoolId: '0761322Z', class: '6e', date: '2026-08-20', nbHours: '2' };

test.beforeEach(async ({ request }) => {
  await resetRateLimit(request);
});

test('an accepted submission answers 201 to an enhanced client', async ({ request }) => {
  const response = await submit(request, ENHANCED, VALID);

  expect(response.status()).toBe(201);
  // The body is what `use:enhance` actually reads, and it still has to say
  // "redirect" — that is what triggers the confirmation toast.
  expect(await response.json()).toMatchObject({ type: 'redirect', status: 303 });
});

test('an accepted submission still answers 303 without JS', async ({ request }) => {
  const response = await submit(request, NO_JS, { ...VALID, nbHours: '3' });

  // Post/Redirect/Get: this redirect is load-bearing for a browser that has no
  // enhanced submit to fall back on, so 201 must not reach it.
  expect(response.status()).toBe(303);
  expect(response.headers()['location']).toBe('/?submitted');
});

test('an invalid submission answers 400 on both paths', async ({ request }) => {
  const withoutSchool = { class: '6e', date: '2026-08-20', nbHours: '1' };

  expect((await submit(request, ENHANCED, withoutSchool)).status()).toBe(400);
  expect((await submit(request, NO_JS, withoutSchool)).status()).toBe(400);
});

test('a throttled submission answers 429', async ({ request }) => {
  // The quota is five a minute, and each of these is a different report so the
  // duplicate guard stays out of it.
  for (let i = 1; i <= 5; i++) {
    await submit(request, ENHANCED, { ...VALID, date: `2026-08-2${i}` });
  }

  const response = await submit(request, ENHANCED, { ...VALID, date: '2026-08-26' });

  expect(response.status()).toBe(429);
});

test('a duplicate submission answers 429', async ({ request }) => {
  const report = { ...VALID, date: '2026-08-19', discipline: 'maths' };

  expect((await submit(request, ENHANCED, report)).status()).toBe(201);
  expect((await submit(request, ENHANCED, report)).status()).toBe(429);
});
