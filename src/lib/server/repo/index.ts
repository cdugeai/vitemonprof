import { env } from '$env/dynamic/private';
import { createMemoryMissedHourRepo } from './memory';
import { createPostgresMissedHourRepo } from './postgres';
import { createDuckDbMissedHourRepo } from './duckdb';
import type { MissedHourRepo } from './types';

export type { MissedHourRepo } from './types';

const BACKENDS = ['postgres', 'duckdb', 'memory'] as const;
type Backend = (typeof BACKENDS)[number];

function resolveBackend(): Backend {
  const requested = env.MISSED_HOUR_REPO?.trim();

  if (!requested) return 'postgres';

  if (!(BACKENDS as readonly string[]).includes(requested)) {
    // Fail loudly at boot rather than silently falling back to an in-memory store
    // that would drop every report a user submits.
    throw new Error(
      `MISSED_HOUR_REPO="${requested}" is not a known backend (expected: ${BACKENDS.join(' | ')})`
    );
  }

  return requested as Backend;
}

async function createRepo(): Promise<MissedHourRepo> {
  const backend = resolveBackend();

  // The choice is invisible from the outside — a missing `MISSED_HOUR_REPO` silently
  // means "postgres", and the resulting connection error surfaces as an opaque
  // `Failed query: ...` from Drizzle. One line at boot makes the decision auditable.
  console.log(`[repo] missed hours -> ${backend}`);

  switch (backend) {
    case 'memory':
      return createMemoryMissedHourRepo();

    case 'postgres':
      // Imported dynamically, not at the top of the file: `$lib/server/db` throws if
      // `DATABASE_URL` is unset, and a static import would run that check even in
      // memory mode — which is exactly the mode you want when you have no database.
      // Deferring the import keeps the two backends genuinely independent.
      //
      // The raw postgres-js client, not the Drizzle instance: the SQL is built by
      // `repo/sql/` now, so this backend only needs something that can execute a
      // statement with bindings.
      return createPostgresMissedHourRepo((await import('$lib/server/db')).client);

    case 'duckdb': {
      // Same deferral, same reason: only this backend should require `DUCKDB_PATH`,
      // and only this backend should load the native driver. (`./duckdb` itself is
      // safe to import statically — its reference to `@duckdb/node-api` is
      // `import type`, which erases at compile time.)
      //
      // The extra `await` over the Postgres case is DuckDB opening the file, or
      // negotiating the MotherDuck session, up front — so a bad path fails at boot
      // rather than on someone's first page view.
      const { openDuckDb } = await import('$lib/server/db/duckdb');

      return createDuckDbMissedHourRepo(await openDuckDb());
    }
  }
}

/**
 * The single instance the app talks to. Chosen once at module load, and module load
 * happens once per server process, so this is effectively a singleton.
 *
 * Top-level `await` is doing real work here: it means callers get a plain
 * `MissedHourRepo`, not a `Promise<MissedHourRepo>` they'd each have to unwrap. Fine
 * in SvelteKit — server modules are ESM, where top-level await is a supported feature
 * rather than a hack.
 */
export const missedHourRepo: MissedHourRepo = await createRepo();
