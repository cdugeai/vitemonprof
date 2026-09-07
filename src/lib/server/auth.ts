import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
  baseURL: env.ORIGIN,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg' }),
  /**
   * Off, deliberately — this is what makes "dormant" mean dormant.
   *
   * The tables exist (`migrations/004_better_auth.ts`) and the adapter is wired,
   * but nothing in `src/` signs anyone in: the scaffold pages that did were
   * deleted. Leaving `enabled: true` would keep `POST /api/auth/sign-up/email`
   * answering anonymous callers against the production database, because
   * `svelteKitHandler` serves better-auth's routes whether or not any page links
   * to them. Deleting the pages closed the door; this closes the endpoint.
   *
   * When a real login lands, the graduated options are, in order of bluntness:
   *
   * - `{ enabled: true, disableSignUp: true }` — sign-in works, sign-up returns
   *   400 `EMAIL_PASSWORD_SIGN_UP_DISABLED` over HTTP *and* from server code.
   * - `disabledPaths: ['/sign-up/email']` at the top level — the router 404s the
   *   HTTP route before any handler runs, while `auth.api.signUpEmail()` stays
   *   callable from a server action. That is the shape an invite-only or
   *   admin-provisioned flow needs.
   */
  emailAndPassword: { enabled: false },
  plugins: [
    sveltekitCookies(getRequestEvent), // make sure this is the last plugin in the array
  ],
});
