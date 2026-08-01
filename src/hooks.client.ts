import type { HandleClientError } from '@sveltejs/kit';

/**
 * Client-side twin of `handleError` in `hooks.server.ts`.
 *
 * SvelteKit renders its error page for errors thrown while hydrating or during a
 * client-side navigation. Those never reach the server, so they appear in no
 * server log — this hook is the only place they can be observed.
 *
 * Unlike the server hook, it is safe to surface the real message here: the error
 * already exists in the visitor's own browser, so nothing is leaked that they
 * could not read from the devtools console anyway. That is what makes a failure
 * on a device with no reachable console (a phone) diagnosable at all.
 */
export const handleError: HandleClientError = ({ error, event, status, message }) => {
  console.error('[client error]', { status, message, route: event.route.id, error });

  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return { message: `${message} — ${detail}` };
};
