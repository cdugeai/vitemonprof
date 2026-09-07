import knexLib from 'knex';
import { getTableColumns } from 'drizzle-orm';
import { missedHour } from '$lib/server/db/schema';
import type { MissedHour } from '$lib/types/missedHours';
import { STATS_WINDOW_DAYS } from '../types';

/**
 * Knex with **no connection configuration at all**.
 *
 * This is the whole trick: `knex({ client: 'pg' })` never opens a socket, and
 * `.toSQL().toNative()` hands back a `{ sql, bindings }` pair that somebody else
 * executes. So Knex is used here purely as a string builder — no pool, no driver,
 * no lifecycle to manage.
 *
 * The `pg` dialect is chosen for both backends because DuckDB deliberately tracks
 * Postgres syntax: double-quoted identifiers and `$1` placeholders are exactly
 * what it expects. Knex has no DuckDB dialect and does not need one.
 */
const qb = knexLib({ client: 'pg' });

/**
 * Physical column names, read off the Drizzle schema rather than retyped.
 *
 * `schema.ts` has to keep existing — drizzle-kit is what migrates Postgres, and
 * better-auth talks to Drizzle — so it is already the single source of truth for
 * what these columns are called. Deriving from it means a rename there cannot
 * silently desync the queries here, which retyping the strings would allow.
 */
const c = getTableColumns(missedHour);

const TABLE = 'missed_hour';

const COL = {
  uuid: c.uuid.name,
  schoolId: c.schoolId.name,
  class: c.class.name,
  classGroup: c.classGroup.name,
  discipline: c.discipline.name,
  date: c.date_.name,
  nbHours: c.nbHours.name,
  createdAt: c.createdAt.name,
} as const;

/** A statement plus its bound values — the only thing this module hands out. */
export interface SqlQuery {
  readonly sql: string;
  readonly bindings: readonly unknown[];
}

const toQuery = (builder: {
  toSQL(): { toNative(): { sql: string; bindings: readonly unknown[] } };
}): SqlQuery => builder.toSQL().toNative();

/**
 * The one genuine dialect difference, isolated to a single expression.
 *
 * `created_at` has to leave SQL as absolute milliseconds. Reading it as text is
 * not an option: DuckDB renders `2026-08-18 11:00:00+02` — not ISO-8601, and in
 * the *server's* local zone, so the same row would read differently depending on
 * where it is deployed. Both engines can produce epoch millis, they just spell it
 * differently, so the spelling is a parameter rather than two forked queries.
 */
export type SqlDialect = 'postgres' | 'duckdb';

const createdAtMillis: Record<SqlDialect, string> = {
  duckdb: `epoch_ms("${COL.createdAt}")`,
  postgres: `(extract(epoch from "${COL.createdAt}") * 1000)::bigint`,
};

/** Insert one report. Column order is Knex's (alphabetical); bindings match it. */
export function insertMissedHour(mh: MissedHour): SqlQuery {
  return toQuery(
    qb(TABLE).insert({
      [COL.uuid]: mh.uuid,
      [COL.schoolId]: mh.schoolId,
      [COL.class]: mh.class,
      [COL.classGroup]: mh.classGroup,
      [COL.discipline]: mh.discipline,
      [COL.date]: mh.date_,
      [COL.nbHours]: mh.nbHours,
      [COL.createdAt]: mh.createdAt,
    })
  );
}

/** Column aliases `listMissedHours` selects into — shared so the row readers agree. */
export const LIST_ALIAS = {
  uuid: 'uuid',
  schoolId: 'school_id',
  class: 'class',
  classGroup: 'class_group',
  discipline: 'discipline',
  date: 'date',
  nbHours: 'nb_hours',
  createdAtMs: 'created_at_ms',
} as const;

/**
 * All reports, newest first.
 *
 * `uuid` and `date` are cast to text in SQL rather than converted in JS: DuckDB
 * would otherwise hand back `DuckDBUUIDValue` / `DuckDBDateValue` wrappers, and
 * the repo contract is that no engine type reaches the domain. Postgres is
 * unaffected by the cast, so one query serves both.
 */
export function listMissedHours(dialect: SqlDialect): SqlQuery {
  return toQuery(
    qb(TABLE)
      .select(
        qb.raw(`??::text as ??`, [COL.uuid, LIST_ALIAS.uuid]),
        qb.ref(COL.schoolId).as(LIST_ALIAS.schoolId),
        qb.ref(COL.class).as(LIST_ALIAS.class),
        qb.ref(COL.classGroup).as(LIST_ALIAS.classGroup),
        qb.ref(COL.discipline).as(LIST_ALIAS.discipline),
        qb.raw(`??::text as ??`, [COL.date, LIST_ALIAS.date]),
        qb.ref(COL.nbHours).as(LIST_ALIAS.nbHours),
        qb.raw(`${createdAtMillis[dialect]} as ??`, [LIST_ALIAS.createdAtMs])
      )
      .orderBy(COL.createdAt, 'desc')
  );
}

/**
 * The four aggregates for the stats panel, in one round trip.
 *
 * Mostly `qb.raw`, and honestly so: `filter (where …)`, `interval` arithmetic and
 * `::int` casts have no builder API in Knex. What Knex still buys here is `??`
 * identifier escaping — which is what makes `"class"` safe — and `?` bindings, so
 * the window length is a parameter rather than string-concatenated into the SQL.
 */
export function statsMissedHours(windowDays: number = STATS_WINDOW_DAYS): SqlQuery {
  return toQuery(
    qb(TABLE).select(
      qb.raw('coalesce(sum(??), 0)::int as total_hours', [COL.nbHours]),
      qb.raw(
        `coalesce(sum(??) filter (where ?? >= now() - (?::int * interval '1 day')), 0)::int as total_hours_last_7d`,
        [COL.nbHours, COL.createdAt, windowDays]
      ),
      qb.raw('count(distinct ??)::int as schools_affected', [COL.schoolId]),
      qb.raw('count(distinct ??)::int as classes_affected', [COL.class])
    )
  );
}
