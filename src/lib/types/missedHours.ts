import type { ClassGroup } from '$lib/classGroups';
import type { Discipline } from '$lib/disciplines';

/**
 * A stored report, with the id the database gave it.
 *
 * `id` is an `integer` from a sequence, not a UUID: see
 * `migrations/003_missed_hour_serial_id.ts`. The practical consequence for
 * everything above this file is that ids are **assigned by the store, on write** —
 * so a report that has not been persisted yet does not have one, which is what
 * `NewMissedHour` is for.
 */
export interface MissedHour extends NewMissedHour {
  id: number;
}

/**
 * A report on its way in — everything except the id.
 *
 * Splitting the type is what makes "the store assigns the id" a rule the compiler
 * enforces rather than a comment. With a single `MissedHour` the caller would
 * have to invent an id it has no business inventing (`0`? `-1`?) just to satisfy
 * the shape, and nothing would stop that placeholder being read back later.
 */
export interface NewMissedHour {
  schoolId: string;
  class: string;
  classGroup: ClassGroup | null;
  /** Subject of the missed class, or `null` when the reporter did not say. */
  discipline: Discipline | null;
  date_: string;
  nbHours: number;
  createdAt: string;
}

export interface MissedHourStats {
  total_hours: number;
  total_hours_last_7d: number;
  schools_affected: number;
  classes_affected: number;
}
