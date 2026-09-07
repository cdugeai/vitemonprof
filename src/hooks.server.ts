import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { getSessionCookie } from 'better-auth/cookies';
import { svelteKitHandler } from 'better-auth/svelte-kit';

/**
 * `auth.api.getSession()` is a database roundtrip. Called unconditionally — as it
 * was here — that is one Postgres query per request on a serverless host,
 * including every hit on `/api/schools`, which returns a cached buffer and has no
 * idea who is asking.
 *
 * Two cheap tests run first, and between them they cover essentially all of this
 * app's traffic:
 *
 * - **No session cookie, no session.** `getSessionCookie` only parses the
 *   `Cookie` header — no crypto, no database. Presence is not proof the token is
 *   valid; `getSession()` still verifies it. What the check rules out is the
 *   certain negatives: static assets, crawlers, and every signed-out visitor.
 * - **Nothing under `/api/` reads `locals`.** `/api/schools` is anonymous, and
 *   better-auth's own endpoints read the cookie themselves rather than going
 *   through `locals`.
 *
 * Note what is narrowed: the *lookup*, not the handler. `svelteKitHandler` still
 * runs on every path, because `/api/auth/*` lives under `/api/` and returning
 * `resolve(event)` early would take better-auth's whole HTTP surface offline. It
 * costs one `new URL()` per request and no-ops everywhere else.
 */
const handleBetterAuth: Handle = async ({ event, resolve }) => {
  const mayHaveSession =
    !building &&
    !event.url.pathname.startsWith('/api/') &&
    getSessionCookie(event.request) !== null;

  if (mayHaveSession) {
    const session = await auth.api.getSession({ headers: event.request.headers });

    if (session) {
      event.locals.session = session.session;
      event.locals.user = session.user;
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
