import { sql, type Kysely, type ColumnDefinitionBuilder } from 'kysely';

/**
 * better-auth's four tables: `user`, `session`, `account`, `verification`.
 *
 * These are the only tables in this repo that the app never queries. better-auth
 * reaches them through `drizzleAdapter(db)` and the generated Drizzle schema in
 * `src/lib/server/db/auth.schema.ts`; nothing in `src/` selects from them, and
 * `scripts/gen-types.ts` deliberately excludes them from `types.generated.ts` for
 * that reason. They are described here because `migrations/` is the only thing in
 * this project that shapes a database — see "Nothing migrates itself" in
 * `CLAUDE.md`.
 *
 * Four things about the shape below are decisions rather than transcription.
 *
 * **Column names are snake_case.** The Drizzle schema's *property* names are
 * camelCase (`emailVerified`, `userId`), but the column strings it passes to
 * `text()` / `timestamp()` are snake_case: better-auth's generator runs every
 * field through `convertToSnakeCase(name, adapter.options.camelCase)`, and
 * `src/lib/server/auth.ts` does not set `camelCase`. What Postgres sees is
 * `email_verified` and `user_id`. Re-run `npm run auth:schema` and read the
 * generated file before assuming otherwise — the two must agree exactly or the
 * adapter fails at runtime with "column does not exist".
 *
 * **Ids are `text`, not integers.** better-auth generates its own string ids
 * because `advanced.database.generateId` is unset. So unlike `002` and `003`,
 * this migration needs no sequence and no `nextval` default, and DuckDB's lack of
 * `serial` never comes up.
 *
 * **Timestamps are `timestamp with time zone`, though the generated schema says
 * plain `timestamp()`.** The divergence is deliberate and only looks like drift.
 * Drizzle no longer builds any DDL here — `drizzle-kit push` is gone — so that
 * declaration is a type annotation, and the round trip is decided by the driver.
 * Drizzle sends `value.toISOString()`; postgres-js parses oids 1082, 1114 and
 * 1184 through the same `new Date(x)`. A `timestamp without time zone` therefore
 * comes back as `2026-08-31 10:00:00` with no offset, which `new Date` reads as
 * *local* time — silently shifting `session.expires_at` by the server's UTC
 * offset. `timestamptz` carries `+00` and survives the trip. It is also what
 * `001` and `003` already use.
 *
 * **`on delete cascade` is applied on Postgres only.** DuckDB parses the
 * constraint but not the action: `FOREIGN KEY constraints cannot use CASCADE, SET
 * NULL or SET DEFAULT`. Postgres is the only engine better-auth ever talks to —
 * `src/lib/server/db/index.ts` is postgres-only and the adapter is built with
 * `provider: 'pg'` — so it gets the real constraint, and DuckDB gets the same
 * foreign key without the action. DuckDB still *enforces* the plain key; it just
 * cannot clean up after a delete. Nothing else differs between the two engines.
 *
 * (better-auth deletes sessions and accounts explicitly before deleting a user,
 * so the cascade is not what makes the app correct. It is what stops a manual
 * `delete from "user"` — the realistic case, since there is no admin UI — from
 * leaving orphans behind.)
 *
 * No `ifNotExists()`, unlike `001` and `002`: those described tables that already
 * existed everywhere. These have never existed on any target — `auth.schema.ts`
 * has been the unrun generator stub since the project was scaffolded, so
 * `drizzle-kit push` never created them either. A collision here means something
 * unexpected is in the database, and should fail rather than be swallowed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const cascade = (await isPostgres(db)) ? 'cascade' : undefined;

  await db.schema
    .createTable('user')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('email', 'text', (c) => c.notNull().unique())
    .addColumn('email_verified', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('image', 'text')
    .addColumn('created_at', timestamptz(), createdAt)
    .addColumn('updated_at', timestamptz(), createdAt)
    .execute();

  await db.schema
    .createTable('session')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('user_id', 'text', (c) => userReference(c, cascade))
    .addColumn('token', 'text', (c) => c.notNull().unique())
    .addColumn('expires_at', timestamptz(), (c) => c.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('created_at', timestamptz(), createdAt)
    .addColumn('updated_at', timestamptz(), createdAt)
    .execute();

  await db.schema.createIndex('session_user_id_idx').on('session').column('user_id').execute();

  await db.schema
    .createTable('account')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('account_id', 'text', (c) => c.notNull())
    .addColumn('provider_id', 'text', (c) => c.notNull())
    .addColumn('user_id', 'text', (c) => userReference(c, cascade))
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('id_token', 'text')
    .addColumn('access_token_expires_at', timestamptz())
    .addColumn('refresh_token_expires_at', timestamptz())
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('created_at', timestamptz(), createdAt)
    .addColumn('updated_at', timestamptz(), createdAt)
    .execute();

  await db.schema.createIndex('account_user_id_idx').on('account').column('user_id').execute();

  await db.schema
    .createTable('verification')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('identifier', 'text', (c) => c.notNull())
    .addColumn('value', 'text', (c) => c.notNull())
    .addColumn('expires_at', timestamptz(), (c) => c.notNull())
    .addColumn('created_at', timestamptz(), createdAt)
    .addColumn('updated_at', timestamptz(), createdAt)
    .execute();

  await db.schema
    .createIndex('verification_identifier_idx')
    .on('verification')
    .column('identifier')
    .execute();
}

/**
 * Children first. Without `on delete cascade` on DuckDB — and with it on
 * Postgres, which still refuses to drop a table another one references — both
 * engines reject `drop table "user"` while `session` or `account` exist.
 * Dropping a table takes its indexes with it, so they need no separate step.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('verification').ifExists().execute();
  await db.schema.dropTable('account').ifExists().execute();
  await db.schema.dropTable('session').ifExists().execute();
  await db.schema.dropTable('user').ifExists().execute();
}

/**
 * Which engine is executing this migration.
 *
 * `select version()` rather than anything on the Kysely adapter: `DuckDbAdapter`
 * reports the same `supportsTransactionalDdl` / `supportsReturning` as
 * `PostgresAdapter`, so the adapter cannot tell them apart. It also has to be a
 * statement both engines *accept* — Kysely runs migrations inside a transaction
 * on both, so a probe that errors on one would poison the whole migration rather
 * than return false.
 *
 * Postgres answers `PostgreSQL 17.x on …`; DuckDB answers `v1.5.5`.
 */
async function isPostgres(db: Kysely<unknown>): Promise<boolean> {
  const { rows } = await sql<{ version: string }>`select version() as version`.execute(db);

  return rows[0]?.version.startsWith('PostgreSQL') ?? false;
}

/** A fresh type node per column — `sql` fragments are not meant to be shared. */
function timestamptz() {
  return sql`timestamp with time zone`;
}

/**
 * `default now()` on every `created_at` *and* `updated_at`.
 *
 * The generated Drizzle schema omits the default on `session.updated_at` and
 * `account.updated_at`, because better-auth always supplies both values on
 * insert. The default is therefore unreachable from the app; it exists so that a
 * hand-written `insert` — a seed, a repair — is legal, and so all eight timestamp
 * columns read the same.
 */
function createdAt(c: ColumnDefinitionBuilder) {
  return c.notNull().defaultTo(sql`now()`);
}

/** `user_id` on `session` and `account`; see the cascade note above. */
function userReference(c: ColumnDefinitionBuilder, cascade: 'cascade' | undefined) {
  const column = c.notNull().references('user.id');

  return cascade ? column.onDelete(cascade) : column;
}
