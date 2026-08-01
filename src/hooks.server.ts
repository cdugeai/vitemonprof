import type { Handle, HandleServerError } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

/**
 * Runs on every unexpected server error. The browser only ever sees the generic
 * "500 Internal Error" page — SvelteKit deliberately hides the cause so stack
 * traces and secrets can't leak — so this is the only place the real error gets
 * recorded. `errorId` is rendered into the error page, which lets a user report
 * ("I got id abc123") be matched against a specific log line.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
  const errorId = crypto.randomUUID();

  console.error('[server error]', {
    errorId,
    status,
    message,
    route: event.route.id,
    url: event.url.pathname + event.url.search,
    userAgent: event.request.headers.get('user-agent'),
    error,
  });

  return { message: 'Internal Error', errorId };
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
  }

  return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
