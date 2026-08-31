import { sql, type Kysely } from 'kysely';

/**
 * Drop the `task` table and its sequence. It is a leftover from the project
 * scaffold and nothing in `src/` reads or writes it.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('task').ifExists().execute();
  await sql`drop sequence if exists task_id_seq`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`create sequence if not exists task_id_seq`.execute(db);

  await db.schema
    .createTable('task')
    .ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().defaultTo(sql`nextval('task_id_seq')`))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('priority', 'integer', (c) => c.notNull().defaultTo(1))
    .execute();
}
