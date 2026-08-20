/**
 * Drizzle schema — **for better-auth only.**
 *
 * This used to declare `missed_hour` and `task` as well, and `drizzle-kit push`
 * diffed those declarations against the database to generate DDL. Both jobs have
 * moved:
 *
 * - **What the database looks like** is decided by the versioned scripts in
 *   `migrations/`, applied with `npm run db:migrate`.
 * - **What TypeScript knows about it** comes from `types.generated.ts`, produced
 *   from the live database by `npm run db:types`.
 *
 * So the app's own tables are described in exactly one place that is derived from
 * exactly one source of truth. Re-declaring them here in Drizzle form would put a
 * second, hand-maintained copy next to a generated one — which is the drift this
 * arrangement exists to prevent.
 *
 * What remains is better-auth's territory. It reaches the database through
 * `drizzleAdapter(db)`, which needs a Drizzle schema object; `auth.schema.ts` is
 * generated for that by `npm run auth:schema`.
 */
export * from './auth.schema';
