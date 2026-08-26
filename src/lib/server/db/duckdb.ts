import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { env } from '$env/dynamic/private';
import { describeDuckDbTarget } from './duckdbTarget';

/**
 * Opened once and shared. `DuckDBInstance.create` is genuinely async (it may be
 * opening a file or negotiating a MotherDuck session), so unlike `postgres-js`
 * this cannot be a plain module-level export — callers get the promise instead,
 * and `repo/index.ts` awaits it exactly once at boot.
 *
 * "Once" is per *process*, which is worth keeping in mind: on a platform that
 * runs several instances of the app, everything below happens once per instance.
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

  console.log(`[duckdb] ${describeDuckDbTarget(path)}`);

  // Opening a database is not migrating it. This used to call `migrateDuckDb`,
  // on the reasoning that a DuckDB file appears out of nowhere and has no
  // "provision the database" moment to hang a migration on. True of a file, and
  // false of everything else: `md:` is a shared network database that several
  // instances of this app open at once, so migrating here means all of them
  // applying the same DDL against the same `kysely_migration` ledger, with no
  // lock to serialise them (`duckdbDialect.ts` implements Kysely's as a no-op).
  //
  // Rather than branch on which kind of database this is, the app now does what
  // it already does for Postgres, for every target alike: assume the schema is
  // there, and let a missing table say so if it is not. Migrating is
  // `npm run db:migrate:duckdb`, run deliberately by a person or a pipeline —
  // never as a side effect of serving a request.
  return connection;
}
