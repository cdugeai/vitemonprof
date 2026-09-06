import { expect, test, type Page } from '@playwright/test';
import { resetRateLimit } from './support/rate-limit';

test.beforeEach(async ({ request }) => {
  await resetRateLimit(request);
});

interface ReportFields {
  schoolId: string;
  class: string;
  date: string;
  nbHours: string;
  discipline?: string;
  classGroup?: string;
}

async function submitReport(page: Page, fields: ReportFields) {
  return page.evaluate(async (data) => {
    const body = new FormData();
    for (const [name, value] of Object.entries(data)) body.append(name, value);

    const res = await fetch('/', { method: 'POST', body, redirect: 'manual' });
    const text = await res.text();

    return {
      status: res.status,
      // A SvelteKit action answers a rejected submission with 200 and the
      // failure in the body, so the message is what carries the outcome.
      isDuplicate: text.includes('Vous avez déjà effectué ce signalement.'),
      isRateLimited: text.includes('Trop de signalements'),
    };
  }, fields);
}

const BASE: ReportFields = {
  schoolId: '0761322Z',
  class: '6e',
  date: '2026-08-20',
  nbHours: '2',
  discipline: 'maths',
};

test('the same report sent twice is refused the second time', async ({ page }) => {
  await page.goto('/');

  const first = await submitReport(page, BASE);
  const second = await submitReport(page, BASE);

  expect(first.isDuplicate).toBe(false);
  expect(second.isDuplicate).toBe(true);
  // Not the burst limit — two submissions are nowhere near five a minute. If
  // this ever flips, the wrong guard is doing the work.
  expect(second.isRateLimited).toBe(false);
});

test('a batch of different reports goes through in one sitting', async ({ page }) => {
  await page.goto('/');

  // The legitimate case the guard must not break: one parent filing a week of
  // absences back to back. Five is also exactly the burst quota, so this pins
  // both limits at once — the batch has to clear them both.
  const week = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'];

  const results = [];
  for (const date of week) {
    results.push(await submitReport(page, { ...BASE, date }));
  }

  expect(results.map((r) => r.isDuplicate)).toEqual([false, false, false, false, false]);
  expect(results.map((r) => r.isRateLimited)).toEqual([false, false, false, false, false]);
});

test('a report differing in one field is not a duplicate', async ({ page }) => {
  await page.goto('/');

  await submitReport(page, BASE);

  // Same school, class and day; different subject. Two different claims, and
  // the second one was meant.
  const other = await submitReport(page, { ...BASE, discipline: 'svt' });

  expect(other.isDuplicate).toBe(false);
});

test('the duplicate is refused before it reaches the store', async ({ page }) => {
  await page.goto('/');

  // A distinctive school id so the recent-reports list can be counted without
  // other specs' rows getting in the way.
  const unique = { ...BASE, schoolId: '0dupguard0' };

  await submitReport(page, unique);
  await submitReport(page, unique);

  await page.reload();

  // One row, not two: the guard has to stop the write, not merely warn about it.
  await expect(page.getByRole('listitem').filter({ hasText: '0dupguard0' })).toHaveCount(1);
});
