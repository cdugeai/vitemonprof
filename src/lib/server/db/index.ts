import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

/**
 * The raw postgres-js client, exported alongside the Drizzle instance.
 *
 * The missed-hour repo now executes SQL built by `repo/sql/`, so it needs
 * `client.unsafe(sql, bindings)` rather than Drizzle's query builder. `db` stays
 * because better-auth is wired to `drizzleAdapter(db)`, which needs a Drizzle
 * schema object. Nothing else here uses Drizzle: `missed_hour` is queried through
 * the shared Kysely layer in `repo/sql/`, migrated by `migrations/`, and typed by
 * `types.generated.ts`.
 */
export const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });
