import type { Kysely } from 'kysely';

/**
 * `task` is a leftover from the project scaffold — nothing in `src/` reads or
 * writes it. It is described here only so the migrations account for the database
 * that actually exists; dropping it is a separate decision and belongs in its own
 * numbered migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('task')
    .ifNotExists()
    .addColumn('id', 'serial', (c) => c.primaryKey())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('priority', 'integer', (c) => c.notNull().defaultTo(1))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('task').ifExists().execute();
}
