/**
 * The schema, as hand-written DDL.
 *
 * Postgres gets its schema from the versioned scripts in `migrations/`. DuckDB
 * cannot use those: Kysely's `Migrator` needs a dialect that can execute, and
 * Kysely has no DuckDB dialect — the shared query layer only ever *compiles* SQL
 * for this engine, it never runs it.
 *
 * Applied on every connect rather than through a migration folder. `if not exists`
 * makes that idempotent, and at one table it is honest — but it is also the
 * ceiling of this approach: the moment a column needs to *change*, this file needs
 * a real migration story, because nothing here can diff the live schema against
 * the intended one. That is the tax for a backend Drizzle doesn't cover, and it
 * should be a deliberate choice rather than a surprise.
 *
 * The column types are the same words as the Postgres schema — DuckDB implements
 * `uuid`, `date` and `timestamp with time zone` natively — so the two stores agree
 * on what they hold, not just on what TypeScript says they hold.
 */
export const SCHEMA_DDL = `
  create table if not exists missed_hour (
    "uuid"       uuid primary key,
    "school_id"  text not null,
    "class"      text not null,
    "class_group" text,
    "discipline" text,
    "date"       date not null,
    "nb_hours"   integer not null,
    -- No \`default now()\`, unlike the Postgres schema. That default is what makes
    -- an \`alter table ... add column\` unreplayable: the ALTER goes into the WAL,
    -- and reopening the file re-binds the table's defaults during replay, before
    -- there is a database context for \`now()\` to resolve against. DuckDB 1.5.5
    -- raises an INTERNAL error and the file will not open at all. Nothing here
    -- relies on the default — \`add()\` always supplies \`created_at\` — so the
    -- safe schema is the one without it.
    "created_at" timestamp with time zone not null
  );

  -- Columns added after a database file already exists. \`create table if not
  -- exists\` above only ever runs on a *new* file, so without these an existing
  -- local .duckdb would silently keep the old shape and every insert would fail.
  -- \`if not exists\` makes each one idempotent, which is what lets this run on
  -- every connect. This is the poor man's migration table flagged when this
  -- backend was added — workable while the changes are additive, and the point at
  -- which it stops being workable is the point this needs a real migration story.
  alter table missed_hour add column if not exists "class_group" text;
  alter table missed_hour add column if not exists "discipline" text;
`;
