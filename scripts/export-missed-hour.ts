import { exportPreviousDay } from './lib/exportCsv.ts';

/**
 * Dumps the previous day's rows of `missed_hour` to a CSV file.
 *
 *   npm run db:export:hours
 *   npm run db:export:hours -- --day 2026-09-06
 *   npm run db:export:hours -- exports/whatever.csv
 *
 * Run on the 15th, it exports the reports submitted on the 14th (UTC) and names
 * the file after the 14th. Yesterday rather than everything because this is a
 * daily job: each run publishes the slice that appeared since the last one, so
 * the files concatenate into the whole table instead of each restating it.
 *
 * The filter is `created_at`, when the report was *submitted* — not `date`, the
 * day of the class it describes. Someone reporting on Monday an hour missed the
 * previous Thursday belongs in Monday's file; that is what makes every row land
 * in exactly one day's export.
 */
await exportPreviousDay({
  table: 'missed_hour',
  createdColumn: 'created_at',
  filePrefix: 'missed-hour',
});
