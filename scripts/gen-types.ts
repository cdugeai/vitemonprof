import { spawnSync } from 'node:child_process';

/**
 * Regenerates `src/lib/server/db/types.generated.ts` from a live database.
 *
 * This is Kysely's model, and it runs the opposite way round to Drizzle's: the
 * migrations in `migrations/` change the database, and the TypeScript types are
 * *derived from* the database afterwards. Drizzle went schema file → migration →
 * database; Kysely goes migration → database → types. Only one end can be the
 * source of truth, and here it is the migrations.
 *
 * A wrapper around `kysely-codegen` rather than a bare script entry for one
 * reason: it refuses to run against anything but the local container. Codegen is
 * read-only, but pointing it at Neon would quietly bake production's schema into
 * the repo — including any drift that was never migrated. Generating from the
 * database that `npm run db:migrate` just built is what makes the output a
 * faithful picture of the migrations.
 */
const url = process.env.DATABASE_URL_DOCKER;

if (!url) {
  console.error(
    'DATABASE_URL_DOCKER is not set — see "Which database am I talking to?" in CLAUDE.md'
  );
  process.exit(1);
}

const { hostname, pathname } = new URL(url);

if (!['localhost', '127.0.0.1'].includes(hostname)) {
  console.error(`REFUSING — DATABASE_URL_DOCKER should be local, got ${hostname}`);
  process.exit(1);
}

console.log(`generating types from ${hostname}${pathname}`);

const result = spawnSync(
  'npx',
  [
    'kysely-codegen',
    '--url',
    url,
    '--dialect',
    'postgres',
    '--out-file',
    'src/lib/server/db/types.generated.ts',
    // The auth tables belong to better-auth, which reaches them through Drizzle.
    // Generating types for them here would imply this app queries them.
    '--exclude-pattern',
    '(user|session|account|verification|kysely_migration*)',
  ],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
