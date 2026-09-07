import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resetRateLimit } from './support/rate-limit';

test.beforeEach(async ({ request }) => {
  await resetRateLimit(request);
});

async function submitReport(page: Page, fields: Record<string, string>) {
  return page.evaluate(async (data) => {
    const body = new FormData();
    for (const [name, value] of Object.entries(data)) body.append(name, value);
    await fetch('/', { method: 'POST', body, redirect: 'manual' });
  }, fields);
}

/**
 * The « Total des heures manquées » tile, as a number.
 *
 * Read rather than asserted against a fixed value: the suite shares one
 * in-memory store, so every spec that submits a report moves this. What this
 * test is about is the *delta*, which is stable however much came before.
 */
async function totalHours(page: Page): Promise<number> {
  await page.goto('/');

  // The tile is two sibling `<p>`s: the number, then its label. Anchoring on the
  // label and stepping back is stabler than a class selector.
  const value = page
    .getByText('Total des heures manquées')
    .locator('xpath=preceding-sibling::p[1]');

  // The stats are streamed, so the tile renders '-' until the query lands.
  await expect(value).not.toHaveText('-');

  return Number((await value.textContent())?.trim());
}

/**
 * Stands in for the report coming from somebody else.
 *
 * The duplicate guard refuses the same report twice from one IP inside two
 * minutes — correct in production, and impossible to satisfy from one Playwright
 * client, where every request shares an address.
 */
async function anotherReporter(request: APIRequestContext) {
  await resetRateLimit(request);
}

test('five people reporting one hour count it once in the totals', async ({ page, request }) => {
  const before = await totalHours(page);

  // Exactly the case this exists for: one cancelled two-hour maths lesson,
  // described identically by five different people.
  const hour = {
    schoolId: '0dedupe00',
    class: '6e',
    classGroup: 'B',
    discipline: 'maths',
    date: '2026-08-24',
    nbHours: '2',
  };

  for (let i = 0; i < 5; i++) {
    await submitReport(page, hour);
    await anotherReporter(request);
  }

  const after = await totalHours(page);

  // Two hours were lost, not ten. Before `missed_hour_event` this read +10.
  expect(after - before).toBe(2);
});

test('genuinely different hours still add up', async ({ page, request }) => {
  const before = await totalHours(page);

  const base = {
    schoolId: '0distinct0',
    class: '5e',
    classGroup: 'A',
    date: '2026-08-24',
    nbHours: '1',
  };

  // Same class, same day, three different subjects — three separate hours, and
  // deduplication must not swallow them.
  for (const discipline of ['maths', 'sport', 'svt']) {
    await submitReport(page, { ...base, discipline });
    await anotherReporter(request);
  }

  expect((await totalHours(page)) - before).toBe(3);
});
