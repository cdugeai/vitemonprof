import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resetRateLimit } from './support/rate-limit';

test.beforeEach(async ({ request }) => {
  await resetRateLimit(request);
});

/**
 * Posts a report straight at the form action.
 *
 * Driving the real form for this would mean filling six controls twice over to
 * assert one badge, and the badge does not depend on how the row got there. The
 * happy path through the UI is already covered by `report.spec.ts`.
 */
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

/**
 * Stands in for the report coming from somebody else.
 *
 * Corroboration is by definition two *different* people, and the duplicate
 * guard refuses the same report twice from one IP inside two minutes — which
 * is exactly right in production and impossible to satisfy from one Playwright
 * client, since every request here shares an address. Clearing the guard's
 * buckets is the closest honest stand-in for a second reporter.
 */
async function secondReporter(request: APIRequestContext) {
  await resetRateLimit(request);
}

test('a missed hour reported by several people is badged with the count', async ({
  page,
  request,
}) => {
  await page.goto('/');

  // The same hour, described identically twice: same school, same class, same
  // day, same subject, same duration. `CORROBORATION_KEY` keys on all five, so
  // agreement has to be exact.
  const hour = {
    schoolId: '0limagined0',
    class: '6e',
    date: '2026-08-20',
    nbHours: '2',
    discipline: 'maths',
  };

  await submitReport(page, hour);
  await secondReporter(request);
  await submitReport(page, hour);

  await page.reload();

  const rows = page.getByRole('listitem').filter({ hasText: '0limagined0' });

  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Signalé 2 fois');
  await expect(rows.last()).toContainText('Signalé 2 fois');
});

test('a lone report carries no corroboration badge', async ({ page }) => {
  await page.goto('/');

  await submitReport(page, {
    schoolId: '0lonely00',
    class: '5e',
    date: '2026-08-21',
    nbHours: '1',
  });

  await page.reload();

  const row = page.getByRole('listitem').filter({ hasText: '0lonely00' });

  await expect(row).toBeVisible();
  // "Signalé 1 fois" on every uncorroborated row would be noise; absence is the
  // design, so absence is what gets asserted.
  await expect(row).not.toContainText('Signalé');
});
