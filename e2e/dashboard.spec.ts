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

test('the dashboard ranks départements, and narrows to the one selected', async ({ page }) => {
  await page.goto('/');

  // 1 + 2 + 4 = 7 hours across two Corsican schools, in three genuinely
  // different hours. Submitted once for the whole test: the reports corroborate
  // rather than add up, so re-submitting them would leave the hours alone and
  // inflate the submission count the assertions below pin.
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

  const rows = page.getByRole('listitem');

  // Selecting a département narrows a ranking *of* départements to one row —
  // the zone's own total, which is what the dropdown now means. The two schools
  // are added together rather than ranked against each other.
  await page.goto('/dashboard?departement=2A');

  await expect(rows.first()).toContainText('2A - Corse-du-Sud');
  await expect(rows.first()).toContainText('7');
  // Three lone reports. Both numbers are asserted even though they are equal:
  // the pair is shown on every row, so that it reads as a ratio rather than as
  // an occasional annotation.
  await expect(rows.first()).toContainText('3 créneaux · 3 soumissions');
  await expect(rows).toHaveCount(1);

  // Nationally the same 7 hours are one entry among the other départements.
  // Matched by content rather than by rank: no other spec reports in Corsica,
  // but several report elsewhere, so 2A's position is not this test's to fix.
  await page.goto('/dashboard');

  const corsica = rows.filter({ hasText: '2A - Corse-du-Sud' });

  await expect(corsica).toContainText('7');
  await expect(corsica).toContainText('3 créneaux · 3 soumissions');

  // Same data, grouped the other way: maths 3h from two reports beats sport 4h?
  // No — sport wins on hours, which is the point of ranking by hours.
  await page.goto('/dashboard?departement=2A&dimension=discipline');

  await expect(rows.first()).toContainText('Éducation physique et sportive');
  // One report, and the singular is rendered — the count is shown on every row,
  // so `1 soumissions` would be on screen constantly if the plural were fixed.
  await expect(rows.first()).toContainText('1 créneau · 1 soumission');
  await expect(rows.nth(1)).toContainText('Mathématiques');
  await expect(rows.nth(1)).toContainText('2 créneaux · 2 soumissions');
});

test('a département with no reports says so instead of rendering an empty list', async ({
  page,
}) => {
  // 976 is Mayotte, which nothing in the suite reports in.
  await page.goto('/dashboard?departement=976');

  await expect(page.getByText('Aucune soumission ici pour le moment')).toBeVisible();
});

test('the département filter lives in the URL, so the view is linkable', async ({ page }) => {
  await page.goto('/dashboard?departement=2A');

  // Both the selector and the card description reflect the query string on a
  // cold server render — no client state involved, which is the property that
  // makes the link shareable. `.first()` because that is precisely the point:
  // the label is rendered in two places and both have to agree.
  await expect(page.getByText('2A - Corse-du-Sud').first()).toBeVisible();
  // And the card stops claiming to be a top 5, because at this point it is one
  // row: the zone's own total.
  await expect(page.getByText('Département 2A - Corse-du-Sud — total')).toBeVisible();
});

test('narrowing the discipline ranking is still a top 5', async ({ page }) => {
  await page.goto('/dashboard?departement=2A&dimension=discipline');

  // The département is a scope on both dimensions, but it only degenerates the
  // one it also groups by — five subjects are still five subjects.
  await expect(page.getByText('Département 2A - Corse-du-Sud — top 5')).toBeVisible();
});
