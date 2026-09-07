import type { MissedHour, MissedHourStats } from '$lib/types/missedHours';

const data: MissedHour[] = [];
const maxWaitTimeS = 3;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function addMissedHour(mh: MissedHour): Promise<void> {
  await delay(Math.random() * maxWaitTimeS * 1000);
  data.push(mh);
}

export async function getMissedHour(): Promise<MissedHour[]> {
  await delay(Math.random() * maxWaitTimeS * 1000);
  console.log({ mh_from_db: data });

  return data;
}

export async function computeStats(): Promise<MissedHourStats> {
  const mh = await getMissedHour();

  // Rolling window over `createdAt` (an ISO-8601 UTC timestamp): the last 7 * 24h
  // counted back from now, not calendar days.
  const STATS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - STATS_WINDOW_MS;
  const isInLast7d = (m: MissedHour) => Date.parse(m.createdAt) >= cutoffMs;

  const sum_hours = (mh_array: MissedHour[]) =>
    mh_array.reduce(
      (a, b) => ({
        nbHours: a.nbHours + b.nbHours,
      }),
      { nbHours: 0 }
    ).nbHours;

  return {
    total_hours: sum_hours(mh),
    total_hours_last_7d: sum_hours(mh.filter(isInLast7d)),
    classes_affected: new Set(mh.map((m) => m.class)).size,
    schools_affected: new Set(mh.map((m) => m.schoolId)).size,
  };
}
