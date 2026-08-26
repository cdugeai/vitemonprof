import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { DuckDBConnection } from '@duckdb/node-api';
import { Kysely } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { duckDbDialect } from './duckdbDialect';

/**
 * Brings a DuckDB database up to date with `migrations/` — the same files, and
 * the same `Migrator`, that Postgres uses.
 *
 * The app does **not** call this — it did once, on connect, and that is the one
 * caller this must never regain: migrating as a side effect of opening a shared
 * database means every instance of the app doing it at once. `npm run db:migrate`
 * and `npm run db:migrate:duckdb` are how a real database gets migrated.
 *
 * What is left is bringing up a database that this process just created and
 * solely owns, which in practice means the conformance suite's `:memory:` DuckDB:
 * one call and it has the same schema Postgres does, from the same files.
 * `kysely_migration` still records exactly what ran — so unlike the
 * `create table if not exists` DDL this replaced, it can express a change that is
 * not purely additive.
 *
 * Reads `migrations/` off the filesystem, so it needs a runtime with the
 * repository on disk. A test run has one; a serverless bundle does not.
 */
export async function migrateDuckDb(connection: DuckDBConnection): Promise<void> {
  const db = new Kysely<unknown>({ dialect: duckDbDialect(connection) });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.resolve('migrations'),
    }),
  });

  const { error } = await migrator.migrateToLatest();

  if (error) throw error;
}
