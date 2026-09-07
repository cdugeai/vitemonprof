import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client, types } from 'pg';
import { createObjectCsvWriter } from 'csv-writer';

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

const today = formatDate(new Date());

/**
 * Dumps `missed_hour_event` to a CSV file.
 *
 *   npm run db:export:events
 *   npm run db:export:events -- exports/whatever.csv
 *
 * `missed_hour_event` is the deduplicated view (migration 007): one row per
 * distinct missed hour rather than one per submission, which is what every
 * aggregate in the app reads. Summing `nb_hours` over the raw `missed_hour`
 * table counts one cancelled hour once per person who reported it.
 */
const TABLE = 'missed_hour_event';
const outputPath = process.argv[2] ?? 'exports/missed-hour-event-' + today + '.csv';

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
  const { rows } = await client.query(`select * from ${TABLE}`);

  if (rows.length === 0) {
    console.log('No rows found.');
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });

    await createObjectCsvWriter({
      path: outputPath,
      header: Object.keys(rows[0]).map((key) => ({ id: key, title: key })),
    }).writeRecords(rows);

    console.log(`Exported ${rows.length} rows to ${outputPath}`);
  }
} finally {
  await client.end();
}
