import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { resetRateLimitStore } from '$lib/server/rateLimit';

/**
 * Test-only hook: empties the in-process rate-limit buckets.
 *
 * The limiter is a module-level `Map` keyed by IP, so it is *process* state, not
 * per-request state. One dev server serves the whole Playwright run from one IP,
 * which makes the quota a shared resource between spec files: `rate-limit.spec.ts`
 * deliberately exhausts it, and every later submit — `report.spec.ts`'s included —
 * came back 429. Serial workers don't help; the leak is across tests, not between
 * them in parallel.
 *
 * Waiting out the 60 s window would work and would cost a minute per spec. Resetting
 * is the same trick `rateLimit.spec.ts` already uses in its `beforeEach`; this route
 * is only what lets an out-of-process test reach it.
 *
 * Two locks, because a public "clear the abuse counters" button is exactly the
 * endpoint an attacker wants: `dev` compiles the body out of a production build
 * entirely, and `E2E_TEST_HOOKS` keeps it dark on an ordinary `npm run dev` — only
 * `playwright.config.ts` sets it. Anything else gets the same 404 as a typo'd URL,
 * which is also what stops the route from advertising that it exists.
 */
export const POST = () => {
  if (!dev || env.E2E_TEST_HOOKS !== 'true') {
    error(404, 'Not found');
  }

  resetRateLimitStore();

  return new Response(null, { status: 204 });
};
