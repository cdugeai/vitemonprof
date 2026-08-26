import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Kysely, sql } from 'kysely';
// Kysely ships the migrator on a subpath, not from the package root.
import { FileMigrationProvider, Migrator, NO_MIGRATIONS } from 'kysely/migration';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import { DuckDBInstance } from '@duckdb/node-api';
import { duckDbDialect } from '../src/lib/server/db/duckdbDialect.ts';
import { describeDuckDbTarget, isMotherDuck } from '../src/lib/server/db/duckdbTarget.ts';

/**
 * Applies the migrations in `migrations/` to Postgres.
 *
 * Replaces `drizzle-kit push`, and differs from it in the way that matters: push
 * *diffed* `schema.ts` against the live database and generated whatever DDL closed
 * the gap. This applies explicit, ordered, versioned scripts and records them in
 * `kysely_migration`. More to write, but the SQL that runs in production is the
 * SQL you read in the diff — and rollbacks exist.
 *
 * Deliberately standalone, not importing `$lib/server/db`: that module is
 * SvelteKit-only (`$env/dynamic/private`), and a migration has to run from a plain
 * `node` process during a deploy or in CI. It uses `postgres-js` directly, the
 * same driver the app uses, via Kysely's own dialect for it — so this introduces
 * no second database driver.
 *
 * Run with `npm run db:migrate`. No ts-node or dotenv package involved: Node 24
 * strips the types itself and reads `.env` with `--env-file`.
 */
/**
 * `--duckdb` runs the *same* migration files against DuckDB.
 *
 * That is the whole reason `duckdbDialect.ts` exists: DuckDB accepts the SQL
 * Kysely's Postgres compiler emits, so once it has a driver there is no reason
 * for it to carry a separate hand-written schema.
 */
const useDuckDb = process.argv.includes('--duckdb');
const DATABASE_URL = useDuckDb ? process.env.DUCKDB_PATH : process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(useDuckDb ? 'DUCKDB_PATH is not set' : 'DATABASE_URL is not set');
  process.exit(1);
}

async function openDatabase(): Promise<Kysely<unknown>> {
  if (useDuckDb) {
    const connection = await (await DuckDBInstance.create(DATABASE_URL!)).connect();
    return new Kysely<unknown>({ dialect: duckDbDialect(connection) });
  }

  // `max: 1` because migrations must run on a single connection: Kysely takes an
  // advisory lock to stop two deploys migrating at once, and a lock is held by a
  // connection, not by the pool.
  const client = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
  return new Kysely<unknown>({ dialect: new PostgresJSDialect({ postgres: client }) });
}

const db = await openDatabase();

// Never the raw value on either branch: a Postgres URL carries the password and
// an `md:` URL may carry the MotherDuck token as a query parameter.
console.log(
  useDuckDb
    ? `duckdb: ${describeDuckDbTarget(DATABASE_URL)}`
    : `postgres: ${new URL(DATABASE_URL).hostname}`
);

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve('migrations') }),
});

const command = process.argv.filter((a) => !a.startsWith('--'))[2] ?? 'up';

async function run() {
  switch (command) {
    case 'down':
      // One step back, which is what you want after a bad deploy.
      return migrator.migrateDown();
    case 'reset':
      return migrator.migrateTo(NO_MIGRATIONS);
    case 'status': {
      const all = await migrator.getMigrations();
      for (const m of all) {
        console.log(`  ${m.executedAt ? '✓ applied' : '· pending'}  ${m.name}`);
      }

      // `getMigrations()` only reports what the *provider* can see, so a ledger
      // entry whose file has been deleted does not appear at all — the status
      // looks clean while `migrateToLatest` refuses to run with "corrupted
      // migrations". Reading the table directly is what surfaces that, and it is
      // the common case after a `git revert` that drops a migration file.
      const executed = await db
        .withoutPlugins()
        .selectFrom('kysely_migration')
        .select('name')
        .execute()
        .catch(() => [] as { name: string }[]);

      const known = new Set(all.map((m) => m.name));
      for (const row of executed) {
        if (!known.has(row.name)) {
          console.log(`  ⚠ orphaned  ${row.name}  (in the database, no file on disk)`);
        }
      }

      return { error: undefined, results: [] };
    }
    default:
      return migrator.migrateToLatest();
  }
}

const { error, results } = await run();

for (const r of results ?? []) {
  console.log(
    r.status === 'Success'
      ? `  ✓ ${r.direction} ${r.migrationName}`
      : `  ✗ ${r.direction} ${r.migrationName} (${r.status})`
  );
}

if (error) {
  console.error('migration failed:', error);
  await db.destroy();
  process.exit(1);
}

if (command !== 'status' && (results ?? []).length === 0) console.log('  nothing to apply');

// A checkpoint flushes the WAL into the database file, so no schema change is
// left to replay on the next open. DuckDB 1.5.5 fails an internal assertion
// replaying an `alter table` when the table carries a `default now()`, and a file
// that will not reopen is a bad way to discover that. This used to run at app
// boot, next to the migration it protects; it belongs wherever the migration is,
// and the migration is here now.
//
// Skipped for MotherDuck because there is no local WAL behind a network session
// to flush — the one thing in this script that looks at *which* DuckDB it is.
if (useDuckDb && !isMotherDuck(DATABASE_URL) && command !== 'status') {
  await sql`checkpoint`.execute(db);
}

await db.destroy();
