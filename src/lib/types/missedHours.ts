import type { ClassGroup } from '$lib/classGroups';
import type { Discipline } from '$lib/disciplines';

export interface MissedHour {
  uuid: string;
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
