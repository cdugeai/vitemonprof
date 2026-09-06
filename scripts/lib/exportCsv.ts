import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client, types } from 'pg';
import { createObjectCsvWriter } from 'csv-writer';
import { dayWindow, previousDay, type ExportDay } from '../../src/lib/server/exportDay.ts';

/**
 * The half of the two export scripts that is the same for both.
 *
 * They differ in one relation and one timestamp column; everything else — which
 * day, which database, how a row becomes a CSV cell — has to be identical, and
 * the surest way to keep two scripts identical is to have only one copy. That
 * matters most for the day window: an export that filtered rows differently from
 * the way it stamps the filename would be wrong in a way nobody notices for
 * months.
 */
export interface ExportOptions {
  /** Table or view to dump. Interpolated, so never from user input. */
  readonly table: string;
  /** The relation's own "when was this row created" column, filtered on. */
  readonly createdColumn: string;
  /** Filename stem; the day and `.csv` are appended. */
  readonly filePrefix: string;
  /**
   * The arguments to parse, defaulting to this process's own.
   *
   * Overridable because `publish-missed-hour.ts` is not only a wrapper: it has a
   * flag of its own (`--dry-run`), and `parseArgs` rightly rejects options it
   * does not know. So the publisher forwards what is left after removing its
   * own — which also means `--day` reaches this parser through it, and a day
   * that failed can be re-published without editing anything.
   */
  readonly argv?: readonly string[];
}

/**
 * What the export produced. Returned rather than only logged because the
 * publishing script needs all three: the path to hand to data.gouv.fr, the day
 * to describe the resource with, and the count to report.
 */
export interface ExportResult {
  readonly outputPath: string;
  readonly rowCount: number;
  readonly day: ExportDay;
}

/**
 * `--day YYYY-MM-DD` (or `--day=…`), plus an optional output path.
 *
 * The day is a flag rather than a bare argument because the *path* was already
 * one, and the two are easy to confuse in a way that fails silently: passing
 * `exports/missed-hour-20260906.csv` renames the file without moving the window,
 * so you get the 5th's rows under the 6th's name and no error anywhere. Naming
 * the day makes the two impossible to mix up.
 */
function parseArgs(argv: readonly string[]): { day: ExportDay; outputPath?: string } {
  const rest: string[] = [];
  let iso: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      // npm eats the first `--` and forwards the rest, so this only shows up when
      // the script is run directly with the npm form copied verbatim. Skipping it
      // is kinder than failing on a separator that means "end of my own options".
      continue;
    } else if (arg === '--day') {
      iso = argv[++i];
      if (iso === undefined) throw new Error('--day needs a YYYY-MM-DD date');
    } else if (arg.startsWith('--day=')) {
      iso = arg.slice('--day='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      rest.push(arg);
    }
  }

  if (rest.length > 1) throw new Error(`expected at most one output path, got ${rest.length}`);

  return { day: iso === undefined ? previousDay() : dayWindow(iso), outputPath: rest[0] };
}

export async function exportPreviousDay({
  table,
  createdColumn,
  filePrefix,
  argv = process.argv.slice(2),
}: ExportOptions): Promise<ExportResult> {
  const { day, outputPath } = parseArgs(argv);
  const path = outputPath ?? `exports/${filePrefix}-${day.stamp}.csv`;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  // Host and database name only — the connection string contains the password.
  // `DATABASE_URL` points at Neon by default, so which database a CSV came from is
  // worth printing before the file exists.
  const target = new URL(connectionString);
  console.log(`source: ${target.hostname} db=${target.pathname.slice(1)}`);
  console.log(`day: ${day.iso} (UTC, ${day.start} .. ${day.end})`);

  // Keep the strings Postgres sent rather than letting pg build `Date` objects,
  // which csv-writer would then stringify as `Sun Sep 06 2026 21:20:50 GMT+0200
  // (Central European Summer Time)`. Two separate problems: `date` is a calendar
  // day with no time zone, so parsing it into a `Date` invents a midnight that can
  // land on the previous day; and a timestamp rendered that way is locale prose,
  // not something a spreadsheet or another script will read back.
  types.setTypeParser(types.builtins.DATE, (value) => value);
  types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => value);
  types.setTypeParser(types.builtins.TIMESTAMP, (value) => value);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Half-open, and parameterised rather than `current_date - 1`: the bounds come
    // from the same value as the filename, so the two cannot drift, and the
    // database's own idea of "today" — its `TimeZone` setting — never enters into
    // it.
    const { rows, fields } = await client.query(
      `select * from ${table}
        where ${createdColumn} >= $1 and ${createdColumn} < $2
        order by ${createdColumn}`,
      [day.start, day.end]
    );

    mkdirSync(dirname(path), { recursive: true });

    // Header from `fields`, not from `Object.keys(rows[0])`: with a single day's
    // worth of rows an empty result is ordinary — a Sunday, a holiday — and a
    // downstream job that expects a file every morning should get a header-only
    // CSV rather than nothing at all. pg fills `fields` from the row description
    // even when no row comes back, so the columns are known regardless.
    await createObjectCsvWriter({
      path,
      header: fields.map(({ name }) => ({ id: name, title: name })),
    }).writeRecords(rows);

    console.log(`Exported ${rows.length} rows to ${path}`);

    // An empty file is a legitimate result and a symptom of the same mistake, so
    // it says which column decided. Without this the only feedback is a
    // header-only CSV, which is what sent this export hunting the wrong bug once
    // already.
    if (rows.length === 0) {
      console.log(`(no ${table} rows with ${createdColumn} on ${day.iso})`);
    }

    return { outputPath: path, rowCount: rows.length, day };
  } finally {
    await client.end();
  }
}
