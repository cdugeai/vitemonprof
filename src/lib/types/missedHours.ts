export interface MissedHour {
  uuid: string;
  schoolId: string;
  class: string;
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
