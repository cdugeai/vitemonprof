import { pgTable, serial, integer, text, uuid, date, timestamp, index } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  priority: integer('priority').notNull().default(1),
});

/**
 * One report of an unreplaced teaching hour.
 *
 * Column types are chosen so the database validates what TypeScript can't:
 * - `date` (not `text`) for the day the class was missed — Postgres rejects
 *   anything that isn't a real calendar date, and sorts/filters it correctly.
 *   Drizzle reads it back as a `'YYYY-MM-DD'` string, which is what the domain
 *   type wants, so no conversion is needed.
 * - `timestamp with time zone` for `createdAt` — stored as an absolute instant
 *   rather than a wall clock, so the 7-day window means the same thing wherever
 *   the server runs. This one *does* come back as a JS `Date`, so the repo maps
 *   it to ISO before handing it out.
 *
 * `schoolId` is a plain `text` UAI code with no foreign key: schools live in a
 * CSV, not a table. Worth revisiting if that data ever moves into Postgres.
 */
export const missedHour = pgTable(
  'missed_hour',
  {
    uuid: uuid('uuid').primaryKey(),
    schoolId: text('school_id').notNull(),
    class: text('class').notNull(),
    // Nullable: the group is optional in the form
    classGroup: text('class_group'),
    date_: date('date').notNull(),
    nbHours: integer('nb_hours').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // `list()` orders by `created_at desc` and `stats()` filters on it, so the index
  // is stored descending to match — Postgres can walk it without a sort step.
  (t) => [index('missed_hour_created_at_idx').on(t.createdAt.desc())]
);

export * from './auth.schema';
