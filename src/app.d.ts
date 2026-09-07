import type { User, Session } from 'better-auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      user?: User;
      session?: Session;
      /**
       * The HTTP status a form action wants its response to carry, when
       * SvelteKit would otherwise answer 200. Set by the action, applied by
       * `handleActionStatus` in `hooks.server.ts`.
       */
      actionStatus?: number;
    }

    // interface Error {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
