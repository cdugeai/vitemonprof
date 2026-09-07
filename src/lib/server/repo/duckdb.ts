import type { DuckDBConnection } from '@duckdb/node-api';
import { isClassGroup } from '$lib/classGroups';
import type { MissedHour, MissedHourStats } from '$lib/types/missedHours';
import { STATS_WINDOW_DAYS, type MissedHourRepo } from './types';

/**
 * DuckDB implementation — the same code whether `DUCKDB_PATH` points at a local
 * file or at MotherDuck.
 *
 * Written as raw SQL because Drizzle has no DuckDB dialect. That sounds like a
 * downgrade and mostly isn't: DuckDB deliberately tracks Postgres syntax, so the
 * aggregate below is character-for-character the query in `postgres.ts` —
 * `filter (where …)`, `interval`, `coalesce`, `::int` casts and all. What Drizzle
 * was buying here was identifier quoting and typed rows, and both are cheap to do
 * by hand for three statements.
 *
 * Worth knowing before choosing this backend: DuckDB is a columnar OLAP engine.
 * `stats()` is what it is built for and will stay fast well past the point where
 * the row-store version wouldn't. `add()` is the opposite — one row per user
 * action is the access pattern DuckDB is *least* suited to, and in file mode only
 * a single process may hold the write lock, so this does not survive being run at
 * more than one instance. Fine for local development and a single-node deploy;
 * MotherDuck is the answer for anything beyond that.
 */
export function createDuckDbMissedHourRepo(connection: DuckDBConnection): MissedHourRepo {
  return {
    async add(mh) {
      await connection.run(
        `insert into missed_hour
           ("uuid", "school_id", "class", "class_group", "date", "nb_hours", "created_at")
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [mh.uuid, mh.schoolId, mh.class, mh.classGroup, mh.date_, mh.nbHours, mh.createdAt]
      );
    },

    async list() {
      /**
       * The casts in the select list are the boundary doing its job, not
       * decoration. Left alone, the driver hands back its own wrapper objects —
       * `DuckDBUUIDValue`, `DuckDBDateValue`, `DuckDBTimestampTZValue` — and the
       * repo's whole contract is that no engine type escapes into the domain.
       *
       * `created_at` is the one that would actually bite. Its text form is
       * `2026-08-18 11:00:00+02`: a space instead of `T`, a two-digit offset
       * instead of `+02:00`, and — worse — rendered in the *server's* local zone,
       * so the same row reads differently depending on where it is deployed. V8
       * happens to parse that; the ECMAScript spec does not require any engine to.
       * `epoch_ms` sidesteps the whole question by returning absolute milliseconds
       * as a bigint, which converts to a real ISO string with no parsing at all.
       */
      const reader = await connection.runAndReadAll(
        `select
           "uuid"::text        as uuid,
           "school_id"         as school_id,
           "class"             as class,
           "class_group"       as class_group,
           "date"::text        as date,
           "nb_hours"          as nb_hours,
           epoch_ms("created_at") as created_at_ms
         from missed_hour
         order by "created_at" desc`
      );

      return reader.getRowObjects().map(
        (r) =>
          ({
            uuid: String(r.uuid),
            schoolId: String(r.school_id),
            class: String(r.class),
            classGroup: isClassGroup(r.class_group) ? r.class_group : null,
            date_: String(r.date),
            nbHours: Number(r.nb_hours),
            createdAt: new Date(Number(r.created_at_ms)).toISOString(),
          }) satisfies MissedHour
      );
    },

    async stats() {
      // Identical to the Postgres version, which is the interesting part: the
      // portability here is DuckDB's, not an abstraction of ours.
      const reader = await connection.runAndReadAll(
        `select
           coalesce(sum("nb_hours"), 0)::int as total_hours,
           coalesce(
             sum("nb_hours") filter (where "created_at" >= now() - ($1::int * interval '1 day')),
             0
           )::int as total_hours_last_7d,
           count(distinct "school_id")::int as schools_affected,
           count(distinct "class")::int as classes_affected
         from missed_hour`,
        [STATS_WINDOW_DAYS]
      );

      const [row] = reader.getRowObjects();

      // Unreachable for the same reason as in `postgres.ts` — an aggregate with no
      // `group by` always yields exactly one row — but typed rather than asserted.
      return {
        total_hours: Number(row?.total_hours ?? 0),
        total_hours_last_7d: Number(row?.total_hours_last_7d ?? 0),
        schools_affected: Number(row?.schools_affected ?? 0),
        classes_affected: Number(row?.classes_affected ?? 0),
      } satisfies MissedHourStats;
    },
  };
}
