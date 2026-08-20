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
 * because better-auth is wired to `drizzleAdapter(db)` and drizzle-kit reads
 * `schema.ts` to migrate — two jobs Knex is not doing.
 */
export const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });
