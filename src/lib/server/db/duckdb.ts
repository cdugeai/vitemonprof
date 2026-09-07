import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { env } from '$env/dynamic/private';

/**
 * The schema, as hand-written DDL.
 *
 * Every other backend gets its schema from `schema.ts` via drizzle-kit. DuckDB
 * can't: Drizzle ships dialects for Postgres, MySQL, SQLite, SingleStore and Gel,
 * and DuckDB is none of them. There is no `duckTable`, so there is nothing for
 * `drizzle-kit push` to read.
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
const SCHEMA_DDL = `
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

/**
 * Opened once and shared. `DuckDBInstance.create` is genuinely async (it may be
 * opening a file or negotiating a MotherDuck session), so unlike `postgres-js`
 * this cannot be a plain module-level export — callers get the promise instead,
 * and `repo/index.ts` awaits it exactly once at boot.
 */
let connecting: Promise<DuckDBConnection> | undefined;

export function openDuckDb(): Promise<DuckDBConnection> {
  return (connecting ??= connect());
}

async function connect(): Promise<DuckDBConnection> {
  const path = env.DUCKDB_PATH?.trim();

  if (!path) {
    throw new Error(
      'DUCKDB_PATH is not set (e.g. "./data/vitemonprof.duckdb", ":memory:", or "md:vitemonprof")'
    );
  }

  // One string covers both deployments: a filesystem path runs DuckDB in-process,
  // an `md:` URL runs the identical SQL against MotherDuck. Nothing below this
  // line knows or cares which — that is the whole reason the path is a config
  // value rather than two code paths.
  const instance = await DuckDBInstance.create(path);
  const connection = await instance.connect();

  await connection.run(SCHEMA_DDL);

  // Belt and braces with the missing \`default now()\` above: a checkpoint flushes
  // the WAL into the database file, so there is no ALTER entry left to replay on
  // the next open. Cheap at this size, and it means a schema change can never
  // leave a database that refuses to reopen.
  await connection.run('checkpoint');

  return connection;
}
