import { sql, type ColumnDataType, type Kysely, type RawBuilder } from 'kysely';

/**
 * Replaces `missed_hour.uuid` with a sequence-backed integer `id`.
 *
 * Why: a `uuid` is 16 bytes in the row plus 16 in the primary-key index, against
 * 4 + 4 for an `integer` — and random UUIDs also scatter index inserts across the
 * whole B-tree instead of appending to its right edge. Nothing in the app ever
 * relied on the id being unguessable or client-generated, so the surrogate key
 * has no reason to be that wide. The tradeoff is the usual one: sequential ids
 * are enumerable and disclose row counts, so they must not be exposed anywhere
 * that matters.
 *
 * **Why a rebuild rather than three `alter table`s.** The obvious version — add
 * `id`, backfill, drop the old primary key, drop `uuid` — needs
 * `alter table … drop constraint`, and DuckDB answers that with "No support for
 * that ALTER TABLE option yet!". Since these files now run against both engines,
 * the migration has to be written in the subset both implement: create the new
 * shape, copy into it, swap the names. Postgres is happy either way, and the
 * resulting schema is identical.
 *
 * The copy is `order by created_at` so the new ids follow the order the reports
 * actually arrived in — an unordered `insert … select` would number them by
 * whatever the scan happened to return.
 *
 * `integer`, and `nextval` rather than `serial`, for the same reason as
 * `002_task`: DuckDB implements neither `serial` nor `generated as identity`,
 * while `serial` is only shorthand for exactly this sequence + default.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create sequence if not exists missed_hour_id_seq`.execute(db);

  await createTable(db, 'missed_hour_new', {
    name: 'id',
    type: 'integer',
    fallback: sql`nextval('missed_hour_id_seq')`,
  });

  await sql`
    insert into missed_hour_new (school_id, "class", class_group, discipline, "date", nb_hours, created_at)
    select school_id, "class", class_group, discipline, "date", nb_hours, created_at
    from missed_hour
    order by created_at
  `.execute(db);

  await swapIn(db, 'missed_hour_new');
}

/**
 * The original UUIDs are not recoverable — the column that held them is dropped
 * above, and no copy is kept. This rebuilds the *shape*, minting fresh ids with
 * `gen_random_uuid()` (which DuckDB provides under that name too, so the one
 * statement serves both engines). Rolling back therefore restores the schema and
 * the rows, but not the identifiers: anything holding an old uuid is stale after
 * a round trip.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await createTable(db, 'missed_hour_old', {
    name: 'uuid',
    type: 'uuid',
    fallback: sql`gen_random_uuid()`,
  });

  await sql`
    insert into missed_hour_old (school_id, "class", class_group, discipline, "date", nb_hours, created_at)
    select school_id, "class", class_group, discipline, "date", nb_hours, created_at
    from missed_hour
    order by id
  `.execute(db);

  await swapIn(db, 'missed_hour_old');

  await sql`drop sequence if exists missed_hour_id_seq`.execute(db);
}

/** The one column `up` and `down` disagree on. */
interface KeyColumn {
  name: string;
  type: ColumnDataType;
  fallback: RawBuilder<unknown>;
}

/**
 * The staging table, identical in both directions apart from its key.
 *
 * The primary key is declared as a *named* table-level constraint rather than
 * inline on the column. Postgres derives an inline key's name from the table it
 * was created on and does not revisit it during `rename`, so the staging name
 * would survive the swap and leave a `missed_hour` table wearing a
 * `missed_hour_new_pkey`. Naming it here makes the constraint say what it is
 * whatever the table was called on the way in — and DuckDB parses the same
 * syntax, so it costs nothing in portability.
 */
function createTable(db: Kysely<unknown>, table: string, key: KeyColumn) {
  return db.schema
    .createTable(table)
    .addColumn(key.name, key.type, (c) => c.notNull().defaultTo(key.fallback))
    .addColumn('school_id', 'text', (c) => c.notNull())
    .addColumn('class', 'text', (c) => c.notNull())
    .addColumn('class_group', 'text')
    .addColumn('discipline', 'text')
    .addColumn('date', 'date', (c) => c.notNull())
    .addColumn('nb_hours', 'integer', (c) => c.notNull())
    .addColumn('created_at', sql`timestamp with time zone`, (c) =>
      c.notNull().defaultTo(sql`now()`)
    )
    .addPrimaryKeyConstraint('missed_hour_pkey', [key.name])
    .execute();
}

/**
 * Drop the live table and put `staged` in its place.
 *
 * Dropping the table takes `missed_hour_created_at_idx` with it on both engines,
 * which is what frees the name to be recreated — the index has to be rebuilt
 * regardless, since it belonged to the old table.
 */
async function swapIn(db: Kysely<unknown>, staged: string): Promise<void> {
  await db.schema.dropTable('missed_hour').execute();
  await sql`alter table ${sql.ref(staged)} rename to missed_hour`.execute(db);

  await db.schema
    .createIndex('missed_hour_created_at_idx')
    .on('missed_hour')
    .expression(sql`"created_at" desc`)
    .execute();
}
