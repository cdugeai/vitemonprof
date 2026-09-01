import { sql, type Kysely } from 'kysely';

/**
 * `missed_hour_event` — one row per *distinct missed hour*, rather than one per
 * submission.
 *
 * Why this exists: five people reporting the same cancelled maths hour is one
 * hour of lost teaching, not five. Summing `nb_hours` over `missed_hour`
 * counts it five times, and measured against the real data that overstated the
 * site's headline figures by 54%. Every aggregate — the homepage stats and the
 * dashboard rankings — reads from here instead.
 *
 * **The grouping is `CORROBORATION_KEY`**, spelled in SQL. It has to stay in
 * step with `src/lib/server/repo/types.ts` and `CORROBORATION_COLUMNS` in
 * `repo/sql/missedHourQueries.ts`; the conformance suite asserts the view and
 * that constant agree, so drift fails the build rather than quietly skewing
 * statistics.
 *
 * `nb_hours` is a grouping column, not an aggregate, and that is what makes the
 * dedup exact: it is part of the key, so every row inside a group already
 * carries the same value. There is no "whose duration do we believe?" to answer.
 *
 * **`departement` is aggregated, not grouped.** It is functionally determined by
 * `school_id`, so grouping on it would be harmless in a clean database — but it
 * is nullable, and rows written before `006` keep a null until
 * `scripts/backfill-departement.ts` runs. Grouping would then split one event
 * into a null half and a filled half, silently double-counting exactly the rows
 * this view exists to combine. `max()` ignores nulls, and every non-null value
 * in a group agrees.
 *
 * A plain view, not materialised: Postgres rewrites it into the query, so it
 * costs the same as writing the `group by` inline, and there is nothing to
 * refresh or to serve stale. If the table ever outgrows that, a materialised
 * view is a later migration and no call site changes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Raw SQL rather than Kysely's schema builder: the migration's `db` is
  // `Kysely<unknown>`, so a builder-made select would be untyped anyway, and one
  // readable statement is what both engines have to accept unchanged.
  await sql`
    create view missed_hour_event as
      select
        school_id,
        "class",
        class_group,
        "date",
        discipline,
        nb_hours,
        max(departement) as departement,
        count(*) as submissions,
        min(created_at) as first_reported_at,
        max(created_at) as last_reported_at
      from missed_hour
      group by school_id, "class", class_group, "date", discipline, nb_hours
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop view if exists missed_hour_event`.execute(db);
}
