import type { Handle } from '@sveltejs/kit';

/**
 * Gives the report form's POST a status code that says what happened.
 *
 * Out of the box every submission — accepted, malformed, throttled — is logged
 * as `POST / 200`, for two separate reasons:
 *
 * 1. **The enhanced path answers 200 by design.** `use:enhance` sends the form
 *    with `accept: application/json`, and SvelteKit replies to that with a
 *    200 whose *body* is the real outcome (`{"type":"redirect","status":303}`
 *    or `{"type":"failure","status":400}`). The client reads the body and
 *    ignores the status — see `deserialize()` in `$app/forms` — so the outer
 *    status is free for us to make honest.
 * 2. **A streamed page drops the failure's status.** `+page.server.ts` returns
 *    un-awaited promises from `load`, so the HTML response is chunked, and
 *    SvelteKit builds that streaming `Response` from the headers alone —
 *    `render_response()` passes `status` only on the non-streamed branch. The
 *    400 computed for a `fail()` never reaches the wire.
 *
 * Rather than reverse-engineer either from the response body, the action states
 * its own outcome on `locals.actionStatus` and this hook stamps it on the way
 * out. Statuses stay next to the `fail()` calls that produce them, and the two
 * paths end up logging identically.
 *
 * Only a 200 is ever overwritten. That keeps the no-JS path's real 303 intact —
 * the browser needs that redirect for Post/Redirect/Get — and leaves any 4xx or
 * 5xx SvelteKit raised on its own (a 405, an unhandled throw) alone.
 */
export const handleActionStatus: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  const status = event.locals.actionStatus;
  if (status === undefined || response.status !== 200) return response;

  // `response.body` is a stream and streams are single-use, so the response has
  // to be rebuilt around it rather than copied. `statusText` is deliberately not
  // carried over: it still reads "OK", and an empty one makes Node send the
  // reason phrase that matches the new code.
  return new Response(response.body, { status, headers: response.headers });
};
