import { createWriteStream } from 'node:fs';
import { rename, stat, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

/**
 * Downloads the national school registry CSV into `data/`, unless it is already
 * there.
 *
 *   npm run data:schools            # no-op if the file exists
 *   npm run data:schools -- --force # re-download (dataset is updated upstream)
 *
 * **Why a pre-step and not app startup.** `src/lib/server/data.ts` reads the CSV
 * with `import csv from '…csv?raw'`. That is a *build-time* import: Vite resolves
 * it and inlines the file contents while transforming the module, long before any
 * of our code runs. A download inside `getSchools()` — or in `hooks.server.ts`,
 * or anywhere else at runtime — would be too late; the build would already have
 * failed with "Failed to resolve import". So the download has to happen before
 * Vite starts, which is exactly what npm's `predev`/`prebuild` lifecycle hooks
 * are for. They run automatically, so this stays invisible in day-to-day use.
 *
 * The 25 MB file is gitignored (see `data/.gitignore`) because a git repository
 * is a bad place for a regenerable third-party dataset: every refresh would add
 * another 25 MB blob to history forever.
 */
const DATASET = 'fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre';

/**
 * The Opendatasoft v2.1 export endpoint. Note this is *not* the URL of the
 * dataset's export page (`/explore/assets/<dataset>/export/`) — that one serves
 * HTML, and downloading it would leave a web page on disk named `.csv`.
 *
 * The query string reproduces the file's existing shape exactly, because
 * `parseCSV` depends on all three: `delimiter=;` (the fields contain commas),
 * `use_labels=true` (the parser looks up French column labels such as
 * `Numéro d'UAI`, not machine names), and `with_bom=true`.
 */
const URL_CSV =
  `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/${DATASET}/exports/csv` +
  '?delimiter=%3B&use_labels=true&with_bom=true';

const DEST = fileURLToPath(new URL(`../data/${DATASET}.csv`, import.meta.url));

/** A truncated download would still "exist"; anything this small is not the registry. */
const MIN_BYTES = 1_000_000;

async function sizeOf(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const existing = await sizeOf(DEST);

  if (existing !== null && existing >= MIN_BYTES && !force) {
    console.log(`schools CSV present (${(existing / 1e6).toFixed(1)} MB) — skipping download`);
    return;
  }

  console.log(`downloading schools CSV from data.education.gouv.fr …`);

  const res = await fetch(URL_CSV);

  if (!res.ok || !res.body) {
    throw new Error(`${res.status} ${res.statusText} from the export endpoint`);
  }

  /**
   * Download to a temporary name and `rename` into place only once the stream has
   * finished. `rename` is atomic within a filesystem, so the destination either
   * does not exist or is a complete file — never a half-written one. Without this,
   * a Ctrl-C mid-download leaves a truncated CSV that every later run happily
   * skips over, and the failure surfaces much later as garbled parse results.
   *
   * Streaming rather than `await res.arrayBuffer()` also keeps 25 MB out of the
   * heap; the bytes go straight from the socket to the disk.
   */
  const tmp = `${DEST}.part`;

  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));

    const downloaded = (await sizeOf(tmp)) ?? 0;

    if (downloaded < MIN_BYTES) {
      throw new Error(
        `suspiciously small download (${downloaded} bytes) — leaving destination alone`
      );
    }

    await rename(tmp, DEST);
    console.log(`wrote data/${DATASET}.csv (${(downloaded / 1e6).toFixed(1)} MB)`);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

main().catch((err) => {
  console.error(`could not fetch the schools CSV: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
