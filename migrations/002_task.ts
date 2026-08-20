import { sql, type Kysely } from 'kysely';

/**
 * `task` is a leftover from the project scaffold — nothing in `src/` reads or
 * writes it. It is described here only so the migrations account for the database
 * that actually exists; dropping it is a separate decision and belongs in its own
 * numbered migration.
 *
 * The id uses an explicit sequence rather than `serial`, because these migrations
 * run against DuckDB as well and DuckDB implements neither `serial` nor
 * `generated as identity`. It is not a downgrade for Postgres: `serial` is
 * shorthand for exactly this — the existing column's default is already
 * `nextval('task_id_seq'::regclass)` — so the resulting schema is unchanged.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create sequence if not exists task_id_seq`.execute(db);

  await db.schema
    .createTable('task')
    .ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().defaultTo(sql`nextval('task_id_seq')`))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('priority', 'integer', (c) => c.notNull().defaultTo(1))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('task').ifExists().execute();
  await sql`drop sequence if exists task_id_seq`.execute(db);
}
