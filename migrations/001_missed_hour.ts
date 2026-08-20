import { sql, type Kysely } from 'kysely';

/**
 * `missed_hour`, as a baseline.
 *
 * Written as one create rather than replaying the real history (add
 * `class_group`, then `discipline`, …): the table already exists in every
 * environment that has one, and a faithful replay would be fiction. `ifNotExists`
 * makes this a no-op on those databases and a full create on a fresh one.
 *
 * From here on, every change gets its own numbered file — that is the point of
 * moving off `drizzle-kit push`, which diffed a schema file and generated
 * whatever DDL closed the gap.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('missed_hour')
    .ifNotExists()
    .addColumn('uuid', 'uuid', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull())
    .addColumn('class', 'text', (c) => c.notNull())
    .addColumn('class_group', 'text')
    .addColumn('discipline', 'text')
    .addColumn('date', 'date', (c) => c.notNull())
    .addColumn('nb_hours', 'integer', (c) => c.notNull())
    .addColumn('created_at', sql`timestamp with time zone`, (c) =>
      c.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // `list()` orders by `created_at desc` and `stats()` filters on it, so the index
  // is stored descending to match — Postgres can then walk it without a sort step.
  await db.schema
    .createIndex('missed_hour_created_at_idx')
    .ifNotExists()
    .on('missed_hour')
    .expression(sql`"created_at" desc`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('missed_hour_created_at_idx').ifExists().execute();
  await db.schema.dropTable('missed_hour').ifExists().execute();
}
