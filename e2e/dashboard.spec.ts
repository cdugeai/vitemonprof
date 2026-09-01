import { expect, test, type Page } from '@playwright/test';
import { resetRateLimit } from './support/rate-limit';

test.beforeEach(async ({ request }) => {
  await resetRateLimit(request);
});

/**
 * Two real Corse-du-Sud schools.
 *
 * Corsica on purpose: `2A` is the one département code that appears in no
 * postal code and is not the UAI prefix either — these schools' UAI codes start
 * `620`. A test that used Paris would pass even if the département were being
 * guessed from either of those, so this is the fixture that proves the value
 * comes from the registry's INSEE column. No other spec files reports in
 * Corsica, so the ranking here is this test's alone.
 */
const FERRACCI = { id: '6200015X', name: 'Collège ALBERT FERRACCI Bonifacio' };
const NICOLI = { id: '6200041A', name: 'Collège Jean Nicoli Propriano' };

async function submitReport(
  page: Page,
  fields: { schoolId: string; class: string; date: string; nbHours: string; discipline?: string }
) {
  return page.evaluate(async (data) => {
    const body = new FormData();
    for (const [name, value] of Object.entries(data)) body.append(name, value);

    const res = await fetch('/', { method: 'POST', body, redirect: 'manual' });
    return res.status;
  }, fields);
}

test('the dashboard ranks schools and disciplines within a département', async ({ page }) => {
  await page.goto('/');

  // Ferracci: 1 + 2 = 3 hours. Nicoli: 4 hours, so it must rank first even
  // though it has fewer reports — the ranking is by hours, not report count.
  await submitReport(page, {
    schoolId: FERRACCI.id,
    class: '6e',
    date: '2026-08-20',
    nbHours: '1',
    discipline: 'maths',
  });
  await submitReport(page, {
    schoolId: FERRACCI.id,
    class: '5e',
    date: '2026-08-20',
    nbHours: '2',
    discipline: 'maths',
  });
  await submitReport(page, {
    schoolId: NICOLI.id,
    class: '4e',
    date: '2026-08-20',
    nbHours: '4',
    discipline: 'sport',
  });

  await page.goto('/dashboard?departement=2A');

  const rows = page.getByRole('listitem');

  await expect(rows.first()).toContainText(NICOLI.name);
  await expect(rows.first()).toContainText('4');
  // One report, and the singular is rendered — the count is shown on every row,
  // so `1 signalements` would be on screen constantly if the plural were fixed.
  await expect(rows.first()).toContainText('1 créneau · 1 signalement');
  await expect(rows.nth(1)).toContainText(FERRACCI.name);
  await expect(rows.nth(1)).toContainText('3');
  // Two genuinely different hours at that school, from two lone reports. Both
  // numbers are asserted even though they are equal: the pair is shown on every
  // row, so that it reads as a ratio rather than as an occasional annotation.
  await expect(rows.nth(1)).toContainText('2 créneaux · 2 signalements');

  // Same data, grouped the other way: maths 3h from two reports beats sport 4h?
  // No — sport wins on hours, which is the point of ranking by hours.
  await page.goto('/dashboard?departement=2A&dimension=discipline');

  await expect(page.getByRole('listitem').first()).toContainText('Éducation physique et sportive');
  await expect(page.getByRole('listitem').nth(1)).toContainText('Mathématiques');
});

test('a département with no reports says so instead of rendering an empty list', async ({
  page,
}) => {
  // 976 is Mayotte, which nothing in the suite reports in.
  await page.goto('/dashboard?departement=976');

  await expect(page.getByText('Aucun signalement ici pour le moment')).toBeVisible();
});

test('the département filter lives in the URL, so the view is linkable', async ({ page }) => {
  await page.goto('/dashboard?departement=2A');

  // Both the selector and the card heading reflect the query string on a cold
  // server render — no client state involved, which is the property that makes
  // the link shareable. `.first()` because that is precisely the point: the
  // label is rendered in two places and both have to agree.
  await expect(page.getByText('2A - Corse-du-Sud').first()).toBeVisible();
  await expect(page.getByText('Département 2A - Corse-du-Sud — top 5')).toBeVisible();
});
