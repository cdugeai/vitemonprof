import type { Kysely } from 'kysely';

/**
 * Store the département each report belongs to.
 *
 * **Why a column rather than a join at read time.** The dashboard's question is
 * "top 5 in this département", and the département is a property of the school —
 * which does not live in the database at all. It is parsed from a 27 MB CSV that
 * `MissedHourRepo` deliberately knows nothing about. Without this column the
 * ranking would have to aggregate every row in the table, ship the result to
 * JS, look each school up in the CSV, filter, and only then take the top five:
 * an unbounded transfer and a sort the engine is far better at, to answer a
 * query that is `where … group by … order by … limit 5` if the column exists.
 *
 * The cost of denormalising is the usual one — the value is resolved once, at
 * write time, and a school later reassigned to another département keeps its old
 * one on historical rows. That is arguably the correct behaviour for a report
 * about a specific day, and it is why the column is written from the registry's
 * own INSEE code rather than guessed.
 *
 * **Nullable, deliberately.** Rows written before this migration have no
 * département and no honest way to acquire one in SQL; `scripts/backfill-departement.ts`
 * fills them from the registry, and anything it cannot resolve stays null rather
 * than being assigned a plausible-looking guess. A null is excluded from every
 * département-scoped ranking, which is the truthful outcome.
 *
 * `text`, not a 2-3 char type: `2A` and `971` are not numbers, and both engines
 * treat short `text` and `varchar(n)` identically here.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('missed_hour').addColumn('departement', 'text').execute();

  // The dashboard filters on this column and nothing else, so the index matches
  // the query rather than the table: `departement` leads, and `nb_hours` rides
  // along so the ranking's sum can be answered from the index alone.
  await db.schema
    .createIndex('missed_hour_departement_idx')
    .ifNotExists()
    .on('missed_hour')
    .columns(['departement', 'nb_hours'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('missed_hour_departement_idx').ifExists().execute();
  // `dropColumn` is one of the few `alter table` options DuckDB does implement,
  // so this direction needs none of `003`'s table-rebuild dance.
  await db.schema.alterTable('missed_hour').dropColumn('departement').execute();
}
