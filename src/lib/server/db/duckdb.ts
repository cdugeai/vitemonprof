import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { env } from '$env/dynamic/private';
import { SCHEMA_DDL } from './duckdbSchema';

/**
 * Opened once and shared. `DuckDBInstance.create` is genuinely async (it may be
 * opening a file or negotiating a MotherDuck session), so unlike `postgres-js`
 * this cannot be a plain module-level export — callers get the promise instead,
 * and `repo/index.ts` awaits it exactly once at boot.
 */
let connecting: Promise<DuckDBConnection> | undefined;

export function openDuckDb(): Promise<DuckDBConnection> {
  return (connecting ??= connect());
}

async function connect(): Promise<DuckDBConnection> {
  const path = env.DUCKDB_PATH?.trim();

  if (!path) {
    throw new Error(
      'DUCKDB_PATH is not set (e.g. "./data/vitemonprof.duckdb", ":memory:", or "md:vitemonprof")'
    );
  }

  // One string covers both deployments: a filesystem path runs DuckDB in-process,
  // an `md:` URL runs the identical SQL against MotherDuck. Nothing below this
  // line knows or cares which — that is the whole reason the path is a config
  // value rather than two code paths.
  const instance = await DuckDBInstance.create(path);
  const connection = await instance.connect();

  await connection.run(SCHEMA_DDL);

  // Belt and braces with the missing \`default now()\` above: a checkpoint flushes
  // the WAL into the database file, so there is no ALTER entry left to replay on
  // the next open. Cheap at this size, and it means a schema change can never
  // leave a database that refuses to reopen.
  await connection.run('checkpoint');

  return connection;
}
