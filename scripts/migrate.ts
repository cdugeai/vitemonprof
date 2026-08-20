import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Kysely } from 'kysely';
// Kysely ships the migrator on a subpath, not from the package root.
import { FileMigrationProvider, Migrator, NO_MIGRATIONS } from 'kysely/migration';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

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
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// `max: 1` because migrations must run on a single connection: Kysely takes an
// advisory lock to stop two deploys migrating at once, and a lock is held by a
// connection, not by the pool.
const client = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

const db = new Kysely<unknown>({ dialect: new PostgresJSDialect({ postgres: client }) });

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve('migrations') }),
});

const command = process.argv[2] ?? 'up';

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

await db.destroy();
