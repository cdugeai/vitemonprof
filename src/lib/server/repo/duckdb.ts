import type { DuckDBConnection, DuckDBValue } from '@duckdb/node-api';
import { isClassGroup } from '$lib/classGroups';
import { isDiscipline } from '$lib/disciplines';
import type { MissedHour, MissedHourStats } from '$lib/types/missedHours';
import type { MissedHourRepo } from './types';
import {
  LIST_ALIAS,
  insertMissedHour,
  listMissedHours,
  statsMissedHours,
  type SqlQuery,
} from './sql/missedHourQueries';

/**
 * DuckDB implementation — the same code whether `DUCKDB_PATH` points at a local
 * file or at MotherDuck.
 *
 * Shares every statement with the Postgres backend via `./sql/missedHourQueries`.
 * That works because Knex's `pg` dialect emits double-quoted identifiers and `$1`
 * placeholders, both of which DuckDB accepts unchanged — so "no DuckDB dialect in
 * Knex" turns out not to matter.
 *
 * What stays local is the row marshalling, and here it earns its place: DuckDB
 * hands back `DuckDBUUIDValue` / `DuckDBTimestampTZValue` wrappers rather than JS
 * natives, and the repo contract is that no engine type reaches the domain.
 *
 * Worth knowing before choosing this backend: DuckDB is a columnar OLAP engine.
 * `stats()` is what it is built for. `add()` — one row per user action — is the
 * pattern it suits least, and in file mode only one process may hold the write
 * lock, so this does not survive running at more than one instance. Fine for
 * local development and a single node; MotherDuck is the answer beyond that.
 */
export function createDuckDbMissedHourRepo(connection: DuckDBConnection): MissedHourRepo {
  // DuckDB's driver wants a mutable array, while `SqlQuery` keeps its bindings
  // readonly so no caller can mutate a query after it is built.
  const bind = (q: SqlQuery) => [...q.bindings] as DuckDBValue[];

  return {
    async add(mh) {
      const q = insertMissedHour(mh);
      await connection.run(q.sql, bind(q));
    },

    async list() {
      const q = listMissedHours('duckdb');
      const reader = await connection.runAndReadAll(q.sql, bind(q));

      return reader.getRowObjects().map((r) => {
        // Read into locals before guarding: a type predicate narrows a *name*,
        // and TypeScript will not carry that narrowing back through an indexed
        // access like `r[LIST_ALIAS.classGroup]`.
        const classGroup = r[LIST_ALIAS.classGroup];
        const discipline = r[LIST_ALIAS.discipline];

        return {
          uuid: String(r[LIST_ALIAS.uuid]),
          schoolId: String(r[LIST_ALIAS.schoolId]),
          class: String(r[LIST_ALIAS.class]),
          classGroup: isClassGroup(classGroup) ? classGroup : null,
          discipline: isDiscipline(discipline) ? discipline : null,
          date_: String(r[LIST_ALIAS.date]),
          nbHours: Number(r[LIST_ALIAS.nbHours]),
          // `created_at_ms` arrives as a bigint, which `Number` narrows safely:
          // epoch millis stay exact well past the year 275760.
          createdAt: new Date(Number(r[LIST_ALIAS.createdAtMs])).toISOString(),
        } satisfies MissedHour;
      });
    },

    async stats() {
      const q = statsMissedHours();
      const reader = await connection.runAndReadAll(q.sql, bind(q));
      const [row] = reader.getRowObjects();

      // Unreachable for the same reason as in `postgres.ts` — an aggregate with
      // no `group by` always yields exactly one row — but typed rather than
      // asserted.
      return {
        total_hours: Number(row?.total_hours ?? 0),
        total_hours_last_7d: Number(row?.total_hours_last_7d ?? 0),
        schools_affected: Number(row?.schools_affected ?? 0),
        classes_affected: Number(row?.classes_affected ?? 0),
      } satisfies MissedHourStats;
    },
  };
}
