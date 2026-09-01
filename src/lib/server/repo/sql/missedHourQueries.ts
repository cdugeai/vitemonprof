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
import type { NewMissedHour } from '$lib/types/missedHours';
import { STATS_WINDOW_DAYS, type TopQuery } from '../types';

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

/**
 * Insert one report.
 *
 * No `id` in the values: the column defaults to `nextval('missed_hour_id_seq')`,
 * and `types.generated.ts` types it as `Generated<number>` — so leaving it out is
 * checked, not merely conventional. Supplying one here would work and then
 * silently desynchronise the sequence from the table.
 */
export function insertMissedHour(mh: NewMissedHour): SqlQuery {
  return db
    .insertInto('missed_hour')
    .values({
      school_id: mh.schoolId,
      class: mh.class,
      class_group: mh.classGroup,
      discipline: mh.discipline,
      date: mh.date_,
      nb_hours: mh.nbHours,
      created_at: mh.createdAt,
      departement: mh.departement,
    })
    .compile();
}

/** Column aliases `listMissedHours` selects into — shared so the row readers agree. */
export const LIST_ALIAS = {
  id: 'id',
  schoolId: 'school_id',
  class: 'class',
  classGroup: 'class_group',
  discipline: 'discipline',
  date: 'date',
  nbHours: 'nb_hours',
  createdAtMs: 'created_at_ms',
  corroborations: 'corroborations',
  departement: 'departement',
} as const;

/**
 * The column spelling of `CORROBORATION_KEY` — the partition that decides which
 * rows describe the same missed hour.
 *
 * `satisfies` pins each name to a real column of `missed_hour` as generated from
 * the live database, so a rename that leaves this behind fails the build rather
 * than silently partitioning by nothing.
 */
const CORROBORATION_COLUMNS = [
  'school_id',
  'class',
  'class_group',
  'date',
  'discipline',
  'nb_hours',
] as const satisfies readonly (keyof Database['missed_hour'])[];

/**
 * All reports, newest first.
 *
 * `date` is cast to text in SQL rather than converted in JS: DuckDB would
 * otherwise hand back a `DuckDBDateValue` wrapper, and the repo contract is that
 * no engine type reaches the domain. Postgres is unaffected by the cast, so one
 * query serves both.
 *
 * `id` needs no such treatment — it used to, when it was a `uuid` and DuckDB
 * returned a `DuckDBUUIDValue`. Both drivers hand back a plain number for
 * `integer`, so the column is selected as-is. One fewer cast is a small bonus of
 * the narrower key.
 *
 * `corroborations` rides along as a window function rather than a separate query:
 * see `CORROBORATION_COLUMNS`.
 */
export function listMissedHours(dialect: SqlDialect, limit?: number): SqlQuery {
  let query = db
    .selectFrom('missed_hour')
    .select((eb) => [
      'id',
      'school_id',
      'class',
      'class_group',
      'discipline',
      sql<string>`${eb.ref('date')}::text`.as(LIST_ALIAS.date),
      'nb_hours',
      'departement',
      createdAtMillis(eb, dialect).as(LIST_ALIAS.createdAtMs),
      // A window function, not a self-join or a second round trip: `count(*) over
      // (partition by …)` is evaluated over the *whole* filtered table and only
      // then projected onto each row, so the count stays correct under the
      // `limit` below — the five rows the homepage renders still know how many
      // reports exist behind each of them.
      eb.fn
        .countAll()
        .over((ob) => ob.partitionBy([...CORROBORATION_COLUMNS]))
        .as(LIST_ALIAS.corroborations),
    ])
    .orderBy('created_at', 'desc');

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  return query.compile();
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

/** Column aliases `topMissedHours` selects into — shared so the row readers agree. */
export const TOP_ALIAS = {
  key: 'key',
  totalHours: 'total_hours',
  reportCount: 'report_count',
} as const;

/**
 * The column each `TopDimension` groups by.
 *
 * A lookup rather than a ternary at the call site, and `satisfies` against the
 * generated schema, so the dimension can never widen into an arbitrary string
 * reaching `groupBy` — the one place in this module where a caller-supplied
 * value would otherwise be spliced into SQL as an identifier rather than bound
 * as a parameter.
 */
const DIMENSION_COLUMN = {
  school: 'school_id',
  discipline: 'discipline',
} as const satisfies Record<string, keyof Database['missed_hour']>;

/**
 * The ranking behind the dashboard.
 *
 * `where … group by … order by … limit` — the whole thing runs in the engine and
 * returns at most `limit` rows. The alternative, aggregating every row and
 * ranking in JS, was never really on the table once `departement` became a
 * column: see `migrations/006_missed_hour_departement.ts`.
 *
 * `is not null` on the grouping column does double duty. For `discipline` it
 * drops the reports that never named a subject, which would otherwise rank first
 * under the label "unknown"; for `school_id`, which is `not null` in the schema,
 * it costs nothing and keeps one query serving both dimensions.
 *
 * The tie-break on the key is not cosmetic: without it two departments with
 * equal totals come back in whatever order the engine's hash aggregate happens
 * to produce, which can differ between two runs of the *same* query and makes
 * the page flicker between reloads.
 */
export function topMissedHours({ departement, dimension, limit }: TopQuery): SqlQuery {
  const column = DIMENSION_COLUMN[dimension];

  let query = db
    .selectFrom('missed_hour')
    .select((eb) => [
      eb.ref(column).as(TOP_ALIAS.key),
      eb.fn.sum('nb_hours').as(TOP_ALIAS.totalHours),
      eb.fn.countAll().as(TOP_ALIAS.reportCount),
    ])
    .where(column, 'is not', null)
    .groupBy(column)
    .orderBy((eb) => eb.fn.sum('nb_hours'), 'desc')
    .orderBy(column, 'asc')
    .limit(limit);

  // `null` means "the whole country", which is the absence of a filter rather
  // than `departement is null` — the latter would return only the rows that
  // predate `006` and have never been backfilled.
  if (departement !== null) {
    query = query.where('departement', '=', departement);
  }

  return query.compile();
}
