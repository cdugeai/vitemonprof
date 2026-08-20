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
 * Run on connect rather than as a deploy step because a DuckDB database is
 * usually a local file that appears out of nowhere: there is no "provision the
 * database" moment to hang a migration on. Applying on open makes a fresh file
 * and an existing one converge to the same schema, and `kysely_migration` still
 * records exactly what ran — so unlike the `create table if not exists` DDL this
 * replaced, it can express a change that is not purely additive.
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
