import { exportPreviousDay } from './lib/exportCsv.ts';

/**
 * Dumps the previous day's rows of `missed_hour_event` to a CSV file.
 *
 *   npm run db:export:events
 *   npm run db:export:events -- --day 2026-09-06
 *   npm run db:export:events -- exports/whatever.csv
 *
 * `missed_hour_event` is the deduplicated view (migration 007): one row per
 * distinct missed hour rather than one per submission, which is what every
 * aggregate in the app reads. Summing `nb_hours` over the raw `missed_hour`
 * table counts one cancelled hour once per person who reported it.
 *
 * The day column is therefore `first_reported_at` — the view's own record of
 * when the event came into being, the aggregate of the `created_at` this
 * export's sibling filters on. So the file holds the hours *first* reported
 * yesterday.
 *
 * The one thing that reading loses: an hour first reported last week and
 * corroborated again yesterday stays in last week's file, with the count it had
 * then. Catching it would mean either re-exporting rows already published (its
 * `submissions` having since changed) or re-deriving the view over one day's
 * submissions, which would fork the `CORROBORATION_KEY` grouping into a second
 * copy that migration 007 warns against. The view's own numbers, published once
 * each, is the reading that keeps the CSVs agreeing with the site.
 */
await exportPreviousDay({
  table: 'missed_hour_event',
  createdColumn: 'first_reported_at',
  filePrefix: 'missed-hour-event',
});
