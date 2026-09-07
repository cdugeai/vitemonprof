import { json } from '@sveltejs/kit';
import { getSchools } from '$lib/server/data';

export function GET() {
  const schools = getSchools();
  return json(schools);
}
