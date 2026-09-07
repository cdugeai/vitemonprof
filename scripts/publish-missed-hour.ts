import { exportPreviousDay } from './lib/exportCsv.ts';
import { publishUpdateResource } from './lib/datagouv.ts';

/**
 * Exports the previous day's `missed_hour` rows and publishes the CSV to
 * data.gouv.fr as a resource of type "Mise à jour".
 *
 *   npm run db:publish                      # yesterday
 *   npm run db:publish -- --day 2026-09-01  # re-publish a named day
 *   npm run db:publish -- --dry-run         # export only, print what would be sent
 *
 * This is the daily job behind `.github/workflows/publish-datagouv.yml`. The two
 * halves stay in separate modules — `lib/exportCsv.ts` knows Postgres,
 * `lib/datagouv.ts` knows the platform API — because only their composition is
 * new here; `npm run db:export:hours` still writes the same file without
 * touching the network.
 *
 * **Why `missed_hour` and not `missed_hour_event`.** The issue asks for the
 * submissions, and that is the table the site's own dataset page describes: one
 * row per report, which is the raw thing a reuser can re-aggregate however they
 * like. `missed_hour_event` is our deduplication of it (migration 007); it is a
 * reading, and publishing a reading in place of the data would make the dataset
 * harder to check, not easier.
 */
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Everything except this script's own flag, handed to the exporter's parser.
 *
 * Filtering rather than ignoring `process.argv`: `parseArgs` rejects options it
 * does not recognise — which is the behaviour that makes a mistyped `--day`
 * fail loudly instead of silently exporting yesterday — so `--dry-run` has to be
 * removed rather than passed through. What survives the filter is `--day`, so a
 * night that failed can be re-published without editing anything.
 */
const EXPORT_ARGV = process.argv.slice(2).filter((arg) => arg !== '--dry-run');

/**
 * `vitemonprof-soumissions`, by UUID rather than slug: a slug follows the
 * dataset title and would break this job silently on a rename, while the id is
 * permanent. Overridable so a rehearsal can point at a demo dataset.
 */
const DATASET = process.env.DATAGOUV_DATASET ?? '6a9dd54a4dc8c86f2309aad8';

const API_URL = process.env.DATAGOUV_API_URL ?? undefined;

const { outputPath, rowCount, day } = await exportPreviousDay({
  table: 'missed_hour',
  createdColumn: 'created_at',
  filePrefix: 'missed-hour',
  argv: EXPORT_ARGV,
});

if (DRY_RUN) {
  console.log(`dry run: would publish ${outputPath} to dataset ${DATASET} as type "update"`);
  process.exit(0);
}

const apiKey = process.env.DATAGOUV_API_KEY;
if (!apiKey) {
  // Checked after the export rather than before, so a missing key still leaves
  // the CSV on disk to publish by hand.
  console.error('DATAGOUV_API_KEY is not set');
  process.exit(1);
}

const { resource, created } = await publishUpdateResource({
  datasetId: DATASET,
  apiKey,
  filePath: outputPath,
  apiUrl: API_URL,
  description: describe(day.iso, rowCount),
});

console.log(
  `${created ? 'Published' : 'Replaced'} ${resource.title} (${resource.id}) as type "${resource.type}"`
);

/**
 * The resource description, in French like the rest of the dataset. It states
 * the day and the row count because those are the two things a reuser checks
 * first, and because a header-only file — an ordinary Sunday — is otherwise
 * indistinguishable from a run that half-failed.
 */
function describe(iso: string, rows: number): string {
  const [year, month, dayOfMonth] = iso.split('-');
  const plural = rows === 1 ? '' : 's';

  return (
    `Soumissions reçues le ${dayOfMonth}/${month}/${year} (UTC) : ` +
    `${rows} signalement${plural}. Export automatique quotidien.`
  );
}
