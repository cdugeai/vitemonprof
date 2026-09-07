import postgres from 'postgres';

/**
 * Compares two databases' schemas and prints what differs. **Read-only.**
 *
 * Kysely has no schema-diffing migration generator — you write migrations by
 * hand — so the risk is not that a migration is hard to write, it is that you
 * cannot easily tell whether the one you wrote matches reality. This closes that
 * loop from the other end: build a database purely from `migrations/`, then
 * compare it against the one you care about.
 *
 *   npm run db:migrate            # with DATABASE_URL=<docker>, from empty
 *   npm run db:diff               # docker (from migrations) vs neon (real)
 *
 * Empty output means the migrations reproduce the target exactly. Anything listed
 * is either a migration you have not written yet, or drift applied to the target
 * outside of migrations — both worth knowing before a deploy.
 */
const from = process.env.DATABASE_URL_DOCKER;
const to = process.env.DATABASE_URL_NEON;

if (!from || !to) {
  console.error('Set DATABASE_URL_DOCKER and DATABASE_URL_NEON — see CLAUDE.md');
  process.exit(1);
}

/** Bookkeeping tables belong to the migrator, not to the schema being compared. */
const IGNORED = /^kysely_migration/;

interface Column {
  table: string;
  column: string;
  type: string;
  nullable: string;
  fallback: string | null;
}

async function describe(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  const rows = (await sql`
    select table_name  as table,
           column_name as column,
           data_type   as type,
           is_nullable as nullable,
           column_default as fallback
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position`) as unknown as Column[];

  await sql.end();

  const byKey = new Map<string, Column>();
  for (const r of rows) {
    if (!IGNORED.test(r.table)) byKey.set(`${r.table}.${r.column}`, r);
  }
  return byKey;
}

const label = (url: string) => new URL(url).hostname;

console.log(`comparing  ${label(from)}  ->  ${label(to)}\n`);

const [a, b] = await Promise.all([describe(from), describe(to)]);

const differences: string[] = [];

for (const [key, col] of a) {
  const other = b.get(key);
  if (!other) {
    differences.push(`  only in ${label(from)}:  ${key}  (${col.type})`);
    continue;
  }
  if (col.type !== other.type)
    differences.push(`  type differs: ${key}  ${col.type} vs ${other.type}`);
  if (col.nullable !== other.nullable)
    differences.push(`  nullability differs: ${key}  ${col.nullable} vs ${other.nullable}`);
  if ((col.fallback ?? '') !== (other.fallback ?? ''))
    differences.push(
      `  default differs: ${key}  ${col.fallback ?? 'none'} vs ${other.fallback ?? 'none'}`
    );
}

for (const key of b.keys()) {
  if (!a.has(key)) differences.push(`  only in ${label(to)}:  ${key}`);
}

if (differences.length === 0) {
  console.log('  schemas match');
} else {
  for (const d of differences) console.log(d);
  console.log(`\n  ${differences.length} difference(s)`);
}
