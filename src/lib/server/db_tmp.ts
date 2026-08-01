import type { MissedHour } from '$lib/types/missedHours';

const data: MissedHour[] = [];
const maxWaitTimeS = 3;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function addMissedHour(mh: MissedHour): Promise<void> {
  await delay(Math.random() * maxWaitTimeS * 1000);
  data.push(mh);
}

export async function getMissedHour(): Promise<MissedHour[]> {
  await delay(Math.random() * maxWaitTimeS * 1000);
  return data;
}
