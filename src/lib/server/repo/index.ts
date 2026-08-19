import { env } from '$env/dynamic/private';
import { createMemoryMissedHourRepo } from './memory';
import { createPostgresMissedHourRepo } from './postgres';
import type { MissedHourRepo } from './types';

export type { MissedHourRepo } from './types';

const BACKENDS = ['postgres', 'memory'] as const;
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
      return createPostgresMissedHourRepo((await import('$lib/server/db')).db);
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
