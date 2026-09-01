import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { departementFromInsee, departementFromPostalCode } from '../src/lib/departements.ts';

/**
 * Fills `missed_hour.departement` for rows written before migration 006.
 *
 * The column is nullable and nothing populates it retroactively — a migration
 * could not, because the answer lives in a 27 MB CSV rather than in the
 * database. Until this runs, every pre-006 report is invisible to the
 * dashboard's département filter (though still counted in the national view).
 *
 * Run it once, after `npm run db:migrate`, against each database that has data:
 *
 *   node --env-file=.env scripts/backfill-departement.ts --dry-run
 *   node --env-file=.env scripts/backfill-departement.ts
 *
 * `--url-env=NAME` picks which variable to connect with, defaulting to
 * `DATABASE_URL`. Being explicit matters here: `DATABASE_URL` points at Neon by
 * default, and "I thought it was the Docker one" is exactly the mistake this
 * flag exists to prevent.
 *
 * Idempotent — it only touches rows where `departement is null`, so running it
 * twice is a no-op and re-running it after new reports arrive is harmless.
 * Reports whose school is not in the registry keep their null rather than
 * receiving a plausible-looking guess.
 */
const CSV_PATH = 'data/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre.csv';

const dryRun = process.argv.includes('--dry-run');
const urlEnv = process.argv.find((a) => a.startsWith('--url-env='))?.slice(10) ?? 'DATABASE_URL';
const databaseUrl = process.env[urlEnv];

if (!databaseUrl) {
  console.error(`${urlEnv} is not set`);
  process.exit(1);
}

// Host and database name only. The connection string contains the password, so
// it is never printed — but which server this is about to write to is exactly
// what a person needs to see before answering for the result.
const target = new URL(databaseUrl);
console.log(`target: ${target.hostname} db=${target.pathname.slice(1)} (from ${urlEnv})`);
console.log(dryRun ? 'mode:   dry run, nothing will be written\n' : 'mode:   writing\n');

/** UAI code -> département, built from the registry the same way the app does. */
function schoolDepartements(): Map<string, string> {
  const lines = readFileSync(CSV_PATH, 'utf8').split('\n');
  const headers = lines[0].split(';').map((h) => h.trim());
  const index = (name: string) => headers.indexOf(name);

  const iUai = index("Numéro d'UAI");
  const iInsee = index('Code INSEE du département ou de la collectivité');
  const iPostal = index('Adresse : code postal');

  const map = new Map<string, string>();

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;

    const cells = line.split(';');
    const uai = cells[iUai]?.trim();
    if (!uai) continue;

    // Same precedence as `src/lib/server/data.ts`: the registry's own INSEE code
    // first, the postal-code rule only as a fallback.
    const departement =
      departementFromInsee(cells[iInsee]?.trim() ?? '') ??
      departementFromPostalCode(cells[iPostal]?.trim() ?? '');

    if (departement) map.set(uai, departement);
  }

  return map;
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  const pending = await sql<
    { school_id: string; n: string }[]
  >`select school_id, count(*)::text as n
      from missed_hour
     where departement is null
     group by school_id`;

  if (pending.length === 0) {
    console.log('nothing to backfill — every report already has a département');
  } else {
    const registry = schoolDepartements();
    const resolvable = pending.filter((row) => registry.has(row.school_id));
    const rows = (list: typeof pending) => list.reduce((total, r) => total + Number(r.n), 0);

    console.log(`reports without a département: ${rows(pending)} across ${pending.length} schools`);
    console.log(
      `resolvable from the registry:  ${rows(resolvable)} across ${resolvable.length} schools`
    );

    const unresolved = pending.filter((row) => !registry.has(row.school_id));
    if (unresolved.length > 0) {
      console.log(`\nleft as null (school not in the registry): ${rows(unresolved)} reports`);
      for (const row of unresolved.slice(0, 10)) console.log(`  ${row.school_id} (${row.n})`);
      if (unresolved.length > 10) console.log(`  … and ${unresolved.length - 10} more`);
    }

    if (!dryRun && resolvable.length > 0) {
      // One statement, not one per school: the pairs travel as a values list the
      // engine joins against, so a few thousand schools stay a single round trip.
      const pairs = resolvable.map((row) => [row.school_id, registry.get(row.school_id)!]);

      const updated = await sql`
        update missed_hour
           set departement = mapping.departement
          from (values ${sql(pairs)}) as mapping(school_id, departement)
         where missed_hour.school_id = mapping.school_id
           and missed_hour.departement is null
        returning 1
      `;

      console.log(`\nupdated ${updated.length} reports`);
    }
  }
} finally {
  await sql.end();
}
