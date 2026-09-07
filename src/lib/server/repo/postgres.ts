import type { Sql } from 'postgres';
import { isClassGroup } from '$lib/classGroups';
import { isDiscipline } from '$lib/disciplines';
import type { MissedHour, MissedHourStats, TopMissedHours } from '$lib/types/missedHours';
import type { MissedHourRepo } from './types';
import { insertedId } from './insertedId';
import {
  INSERT_ALIAS,
  LIST_ALIAS,
  TOP_ALIAS,
  insertMissedHour,
  listMissedHours,
  statsMissedHours,
  topMissedHours,
} from './sql/missedHourQueries';

/**
 * Postgres implementation (Neon in production, the Docker container from
 * `compose.yaml` locally).
 *
 * All the SQL now comes from `./sql/missedHourQueries`, shared with the DuckDB
 * backend. What is left here is the half that genuinely cannot be shared: turning
 * this driver's row objects into domain values. postgres-js returns JS natives,
 * so that work is small — which is exactly the point of the split.
 *
 * `sql` is injected rather than imported so this module has no import-time side
 * effects, and so it can be pointed at a throwaway database in a test.
 */
export function createPostgresMissedHourRepo(sql: Sql): MissedHourRepo {
  /**
   * `unsafe` is postgres-js's "run this string" escape hatch, and the name is
   * about *provenance*, not about skipping escaping — the values still travel as
   * bound `$n` parameters, never interpolated. The string comes from Kysely,
   * not from user input, so nothing here is concatenated from a request.
   */
  const run = <T extends Record<string, unknown>>(q: {
    sql: string;
    parameters: readonly unknown[];
  }) => sql.unsafe<T[]>(q.sql, q.parameters as never[]);

  return {
    async add(mh) {
      const [row] = await run(insertMissedHour(mh));

      return insertedId(row?.[INSERT_ALIAS.id]);
    },

    async list(limit?: number) {
      const rows = await run(listMissedHours('postgres', limit));

      return rows.map((r) => {
        // Same reason as in `duckdb.ts`: a type predicate narrows a name, not an
        // indexed access, so these have to be locals before the guards run.
        const classGroup = r[LIST_ALIAS.classGroup];
        const discipline = r[LIST_ALIAS.discipline];

        return {
          id: Number(r[LIST_ALIAS.id]),
          schoolId: String(r[LIST_ALIAS.schoolId]),
          class: String(r[LIST_ALIAS.class]),
          // Validated, not cast: these are plain `text` columns, so the database
          // will happily return whatever an older row or a manual `update` left
          // there. The guards keep the domain type honest.
          classGroup: isClassGroup(classGroup) ? classGroup : null,
          discipline: isDiscipline(discipline) ? discipline : null,
          date_: String(r[LIST_ALIAS.date]),
          departement: nullableString(r[LIST_ALIAS.departement]),
          nbHours: Number(r[LIST_ALIAS.nbHours]),
          createdAt: new Date(Number(r[LIST_ALIAS.createdAtMs])).toISOString(),
          // `count(*)` is a bigint/numeric on the wire in both engines, same as
          // the stats aggregates — hence `Number` rather than a bare read.
          corroborations: Number(r[LIST_ALIAS.corroborations]),
        } satisfies MissedHour;
      });
    },

    async stats() {
      const [row] = await run(statsMissedHours());

      // An aggregate with no `group by` always returns exactly one row, even over
      // an empty table — so the fallbacks are unreachable. They are here to
      // satisfy the compiler without an `!`, which would be a lie that outlives
      // the assumption.
      return {
        total_hours: Number(row?.total_hours ?? 0),
        total_hours_last_7d: Number(row?.total_hours_last_7d ?? 0),
        schools_affected: Number(row?.schools_affected ?? 0),
        classes_affected: Number(row?.classes_affected ?? 0),
      } satisfies MissedHourStats;
    },

    async top(options) {
      const rows = await run(topMissedHours(options));

      return rows.map(
        (r) =>
          ({
            key: String(r[TOP_ALIAS.key]),
            // `sum()` is `numeric` and `count()` is `bigint`, so postgres-js
            // hands both back as strings — the same reason `stats()` funnels
            // everything through `Number`.
            totalHours: Number(r[TOP_ALIAS.totalHours]),
            events: Number(r[TOP_ALIAS.events]),
            submissions: Number(r[TOP_ALIAS.submissions]),
          }) satisfies TopMissedHours
      );
    },
  };
}

/**
 * A nullable `text` column as a domain `string | null`.
 *
 * `String(null)` is `'null'` — a four-character string that is truthy, renders
 * as "null" and compares equal to nothing useful. Every nullable column on the
 * way out needs this guard, not a cast.
 */
function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
