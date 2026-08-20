import type { DuckDBConnection, DuckDBValue } from '@duckdb/node-api';
import {
  CompiledQuery,
  DialectAdapterBase,
  PostgresQueryCompiler,
  sql,
  type DatabaseConnection,
  type ColumnMetadata,
  type DatabaseIntrospector,
  type DatabaseMetadataOptions,
  type Dialect,
  type SchemaMetadata,
  type TableMetadata,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
} from 'kysely';

/**
 * A Kysely dialect for DuckDB.
 *
 * The point of this file: **the SQL was never the problem.** DuckDB deliberately
 * tracks Postgres syntax, so `PostgresQueryCompiler` already emits statements it
 * accepts — double-quoted identifiers, `$1` placeholders and all. The only thing
 * missing was a *driver*: something to hand `{ sql, parameters }` to
 * `@duckdb/node-api` and shape the answer back into Kysely's `QueryResult`.
 *
 * That is roughly forty lines, and with it the migrations in `migrations/` run on
 * DuckDB exactly as they do on Postgres — which is what replaced the separate,
 * hand-maintained `duckdbSchema.ts` and its `add column if not exists` list.
 *
 * Three pieces are borrowed, one is written:
 * - **compiler**: `PostgresQueryCompiler`, unchanged.
 * - **introspector**: a small one over `information_schema`. `PostgresIntrospector`
 *   cannot be reused — it reads `pg_catalog` helpers like
 *   `pg_get_serial_sequence` and `col_description`, which DuckDB does not have.
 * - **adapter**: mostly Postgres behaviour, but the migration lock is a no-op —
 *   see below.
 * - **driver**: the new part.
 */

/**
 * Kysely takes a lock so two deploys cannot migrate at once. `PostgresAdapter`
 * does that with `pg_advisory_xact_lock`, which DuckDB does not have.
 *
 * A no-op is the honest implementation rather than a shortcut: in file mode
 * DuckDB permits exactly one writing process, enforced by an OS-level lock on the
 * file itself. The concurrency this lock exists to prevent cannot occur — a
 * second migrator cannot even open the database.
 */
class DuckDbAdapter extends DialectAdapterBase {
  override get supportsCreateIfNotExists(): boolean {
    return true;
  }

  override get supportsTransactionalDdl(): boolean {
    return true;
  }

  override get supportsReturning(): boolean {
    return true;
  }

  override async acquireMigrationLock(): Promise<void> {}

  override async releaseMigrationLock(): Promise<void> {}
}

/**
 * The Migrator only asks one question of the introspector — "does the migration
 * table exist yet?" — so this covers `information_schema` and nothing more.
 * Anything relying on Postgres catalog internals is out of scope by design.
 */
class DuckDbIntrospector implements DatabaseIntrospector {
  readonly #db: Kysely<unknown>;

  constructor(db: Kysely<unknown>) {
    this.#db = db;
  }

  async getSchemas(): Promise<SchemaMetadata[]> {
    const rows = await sql<{
      schema_name: string;
    }>`select schema_name from information_schema.schemata`.execute(this.#db);

    return rows.rows.map((r) => ({ name: r.schema_name }));
  }

  async getTables(options: DatabaseMetadataOptions = { withInternalKyselyTables: false }) {
    const rows = await sql<{
      table_name: string;
      table_type: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>`
      select t.table_name, t.table_type, c.column_name, c.data_type,
             c.is_nullable, c.column_default
      from information_schema.tables t
      join information_schema.columns c on c.table_name = t.table_name
      where t.table_schema = 'main'
      order by t.table_name, c.ordinal_position`.execute(this.#db);

    const tables = new Map<string, TableMetadata & { columns: ColumnMetadata[] }>();

    for (const r of rows.rows) {
      if (!options.withInternalKyselyTables && r.table_name.startsWith('kysely_migration'))
        continue;

      let table = tables.get(r.table_name);

      if (!table) {
        table = {
          name: r.table_name,
          isView: r.table_type === 'VIEW',
          isForeign: false,
          columns: [],
        };
        tables.set(r.table_name, table);
      }

      table.columns.push({
        name: r.column_name,
        dataType: r.data_type,
        // DuckDB has no serial/identity, so nothing here auto-increments; the
        // `task` sequence shows up as an ordinary default.
        isAutoIncrementing: false,
        isNullable: r.is_nullable === 'YES',
        hasDefaultValue: r.column_default !== null,
      });
    }

    return [...tables.values()];
  }
}

class DuckDbConnection implements DatabaseConnection {
  readonly #connection: DuckDBConnection;

  constructor(connection: DuckDBConnection) {
    this.#connection = connection;
  }

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const parameters = [...compiled.parameters] as DuckDBValue[];
    const result = await this.#connection.runAndReadAll(compiled.sql, parameters);

    return {
      rows: result.getRowObjects() as R[],
      // Kysely wants a bigint here, and reads it for `update`/`delete` results.
      numAffectedRows: BigInt(result.rowsChanged ?? 0),
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    // The driver can stream, but nothing in this app does — and a wrong
    // implementation would fail silently under load rather than at the call site.
    throw new Error('streaming is not implemented for the DuckDB dialect');
  }
}

/**
 * Wraps an already-open `DuckDBConnection`.
 *
 * Deliberately *not* a pool. DuckDB in file mode has a single writer, so handing
 * out several connections would buy nothing and invite the optimistic-concurrency
 * conflicts it raises instead of blocking. `destroy()` is a no-op for the same
 * reason: this driver borrows the connection, it does not own it, and closing it
 * would pull the rug from under whoever passed it in.
 */
class DuckDbDriver implements Driver {
  readonly #connection: DuckDBConnection;

  constructor(connection: DuckDBConnection) {
    this.#connection = connection;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new DuckDbConnection(this.#connection);
  }

  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    // `TransactionSettings.isolationLevel` is ignored: DuckDB has a single
    // isolation level and no `set transaction` syntax to vary it.
    await conn.executeQuery(CompiledQuery.raw('begin transaction'));
  }

  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw('commit'));
  }

  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery(CompiledQuery.raw('rollback'));
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {}
}

export function duckDbDialect(connection: DuckDBConnection): Dialect {
  return {
    createAdapter: () => new DuckDbAdapter(),
    createDriver: (): Driver => new DuckDbDriver(connection),
    createQueryCompiler: (): QueryCompiler => new PostgresQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector => new DuckDbIntrospector(db),
  };
}
