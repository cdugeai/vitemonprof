import { desc, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { isClassGroup } from '$lib/classGroups';
import type { MissedHourStats } from '$lib/types/missedHours';
import * as schema from '$lib/server/db/schema';
import { missedHour } from '$lib/server/db/schema';
import { STATS_WINDOW_DAYS, type MissedHourRepo } from './types';

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Postgres implementation (Neon in production, the Docker container from
 * `compose.yaml` locally — identical code either way, since Neon *is* Postgres).
 *
 * `db` is injected rather than imported so this module has no import-time side
 * effects: nothing here needs `DATABASE_URL` merely to be loaded. That's what lets
 * `./index.ts` choose a backend at runtime, and what makes this class testable
 * against a throwaway database.
 */
export function createPostgresMissedHourRepo(db: Db): MissedHourRepo {
  /**
   * `now() - 7 days`, as a bound parameter rather than an interpolated interval
   * literal. The `::int` cast is load-bearing: without it Postgres sees an untyped
   * parameter next to `interval` and can't resolve which `*` operator to use.
   */
  const windowStart = sql`now() - (${STATS_WINDOW_DAYS}::int * interval '1 day')`;

  return {
    async add(mh) {
      await db.insert(missedHour).values({
        uuid: mh.uuid,
        schoolId: mh.schoolId,
        class: mh.class,
        classGroup: mh.classGroup,
        date_: mh.date_,
        nbHours: mh.nbHours,
        // The domain speaks ISO-8601 strings; the driver wants a `Date`. Converting
        // here — rather than loosening the domain type — is the boundary doing its job.
        createdAt: new Date(mh.createdAt),
      });
    },

    async list() {
      // Unbounded on purpose, to match the interface as written. It's the obvious
      // next thing to fix: the only caller shows five rows, so this wants a
      // `list(limit)` once the table is big enough for it to matter.
      const rows = await db.select().from(missedHour).orderBy(desc(missedHour.createdAt));

      return rows.map((r) => ({
        uuid: r.uuid,
        schoolId: r.schoolId,
        class: r.class,
        // Validated on the way out, not cast. `class_group` is a plain `text`
        // column, so the database will happily hand back anything an older row or
        // a manual `update` put there; the guard keeps the domain type honest
        // rather than trusting Drizzle's compile-time view of the schema.
        classGroup: isClassGroup(r.classGroup) ? r.classGroup : null,
        date_: r.date_,
        nbHours: r.nbHours,
        createdAt: r.createdAt.toISOString(),
      }));
    },

    async stats() {
      /**
       * One round trip, all four aggregates, computed inside the database — the
       * whole reason `stats()` is its own method instead of `list().then(reduce)`.
       * Postgres reads the table once here; the naive version ships every row over
       * the wire to count them.
       *
       * Notes on the SQL:
       * - `filter (where …)` is the standard-SQL way to scope one aggregate without
       *   a subquery or a `case` expression. It also keeps `total_hours` and
       *   `total_hours_last_7d` in a single scan.
       * - `sum()` returns NULL over zero rows (`count()` returns 0), hence
       *   `coalesce` — otherwise an empty table renders "null" in the UI.
       * - `::int` because Postgres `sum()`/`count()` yield `numeric`/`bigint`, which
       *   the driver hands back as *strings* to avoid precision loss. The cast is
       *   what makes `sql<number>` a true statement rather than a lie to the
       *   compiler. Safe at this scale; revisit if hour counts ever approach 2^31.
       * - Columns are interpolated as `${missedHour.x}` rather than written by hand
       *   so Drizzle emits correctly quoted identifiers — which matters for
       *   `"class"`, and means a rename in the schema can't silently desync.
       */
      const [row] = await db
        .select({
          total_hours: sql<number>`coalesce(sum(${missedHour.nbHours}), 0)::int`,
          total_hours_last_7d: sql<number>`
            coalesce(
              sum(${missedHour.nbHours}) filter (where ${missedHour.createdAt} >= ${windowStart}),
              0
            )::int`,
          schools_affected: sql<number>`count(distinct ${missedHour.schoolId})::int`,
          classes_affected: sql<number>`count(distinct ${missedHour.class})::int`,
        })
        .from(missedHour);

      // An aggregate with no `group by` always returns exactly one row, even for an
      // empty table — so this fallback is unreachable. It's here to satisfy the
      // compiler without an `!`, which would be a lie that outlives the assumption.
      return (
        row ??
        ({
          total_hours: 0,
          total_hours_last_7d: 0,
          schools_affected: 0,
          classes_affected: 0,
        } satisfies MissedHourStats)
      );
    },
  };
}
