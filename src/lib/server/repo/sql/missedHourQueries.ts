import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
  type ExpressionBuilder,
} from 'kysely';
import type { DB } from '$lib/server/db/types.generated';
import type { MissedHour } from '$lib/types/missedHours';
import { STATS_WINDOW_DAYS } from '../types';

/**
 * `DB` is generated from the live database by `npm run db:types`, so the column
 * names and types checked here are the ones Postgres actually has — not a
 * hand-written guess that has to be cross-checked against a second declaration.
 *
 * That is what replaced the Drizzle-derived compile-time guard: there is no
 * second schema to disagree with any more.
 */
type Database = DB;

/**
 * Kysely wired to a `DummyDriver` — it can compile queries but can never execute
 * one, which is exactly the contract this module wants. `.compile()` returns
 * `{ sql, parameters }` and somebody else runs it.
 *
 * The Postgres dialect serves both backends: it emits double-quoted identifiers
 * and `$1` placeholders, which DuckDB accepts unchanged. Kysely has no DuckDB
 * dialect and does not need one.
 */
const db = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (d) => new PostgresIntrospector(d),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

/** A statement plus its bound values — the only thing this module hands out. */
export interface SqlQuery {
  readonly sql: string;
  readonly parameters: readonly unknown[];
}

export type SqlDialect = 'postgres' | 'duckdb';

/**
 * The one genuine dialect difference, isolated to a single expression.
 *
 * `created_at` has to leave SQL as absolute milliseconds. Reading it as text is
 * not an option: DuckDB renders `2026-08-18 11:00:00+02` — not ISO-8601, and in
 * the *server's* local zone, so the same row would read differently depending on
 * where it is deployed. Both engines can produce epoch millis, they just spell it
 * differently, so the spelling is a parameter rather than two forked queries.
 */
function createdAtMillis(eb: ExpressionBuilder<Database, 'missed_hour'>, dialect: SqlDialect) {
  const column = eb.ref('created_at');

  return dialect === 'duckdb'
    ? sql<bigint>`epoch_ms(${column})`
    : sql<bigint>`(extract(epoch from ${column}) * 1000)::bigint`;
}

/** Insert one report. */
export function insertMissedHour(mh: MissedHour): SqlQuery {
  return db
    .insertInto('missed_hour')
    .values({
      uuid: mh.uuid,
      school_id: mh.schoolId,
      class: mh.class,
      class_group: mh.classGroup,
      discipline: mh.discipline,
      date: mh.date_,
      nb_hours: mh.nbHours,
      created_at: mh.createdAt,
    })
    .compile();
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
  return db
    .selectFrom('missed_hour')
    .select((eb) => [
      sql<string>`${eb.ref('uuid')}::text`.as(LIST_ALIAS.uuid),
      'school_id',
      'class',
      'class_group',
      'discipline',
      sql<string>`${eb.ref('date')}::text`.as(LIST_ALIAS.date),
      'nb_hours',
      createdAtMillis(eb, dialect).as(LIST_ALIAS.createdAtMs),
    ])
    .orderBy('created_at', 'desc')
    .compile();
}

/**
 * The four aggregates for the stats panel, in one round trip.
 *
 * Built rather than hand-written: `filter (where …)`, `coalesce` and
 * `count(distinct)` are all first-class in Kysely, so the column references are
 * checked against `MissedHourTable` instead of being opaque strings. Only the
 * `interval` arithmetic stays a `sql` fragment, because that is dialect SQL
 * rather than a gap in the builder.
 *
 * Deliberately no `::int` casts. `sum()` and `count()` come back as
 * numeric/bigint — a string from postgres-js, a `bigint` from DuckDB — and both
 * repos already funnel every field through `Number()`. Casting in SQL as well
 * would be a second, redundant place for the same conversion to be wrong.
 */
export function statsMissedHours(windowDays: number = STATS_WINDOW_DAYS): SqlQuery {
  return db
    .selectFrom('missed_hour')
    .select((eb) => [
      eb.fn.coalesce(eb.fn.sum('nb_hours'), sql`0`).as('total_hours'),
      eb.fn
        .coalesce(
          eb.fn
            .sum('nb_hours')
            .filterWhere(
              'created_at',
              '>=',
              sql<Date>`now() - (${windowDays}::int * interval '1 day')`
            ),
          sql`0`
        )
        .as('total_hours_last_7d'),
      eb.fn.count('school_id').distinct().as('schools_affected'),
      eb.fn.count('class').distinct().as('classes_affected'),
    ])
    .compile();
}
