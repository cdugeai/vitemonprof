import { expect, test, type Page } from '@playwright/test';
import { resetRateLimit } from './support/rate-limit';

// These tests submit the form for real, so they need quota. `rate-limit.spec.ts`
// runs first and empties it on purpose.
test.beforeEach(async ({ request }) => {
  await resetRateLimit(request);
});

/**
 * Opens one of the searchable `<Select>`s, types a query, and picks a result.
 *
 * Wrapped in `toPass` because of two separate races, both real:
 *
 * 1. **Hydration.** The trigger is server-rendered, so Playwright can click it
 *    before Svelte has attached any handler — the click lands on a live button
 *    and does nothing at all. Retrying is the standard answer; there is no event
 *    the page exposes that means "hydrated".
 * 2. **Focus.** bits-ui re-focuses the trigger from its own `onclick`, one frame
 *    after the content mounts, so the search field only wins focus once the
 *    component's bounce has run.
 *
 * `toBeFocused` therefore does double duty: it waits out (2), and it asserts the
 * behaviour these selects exist for — clicking the trigger must leave the caret
 * in the search box, so a user can just start typing.
 */
async function pickFromSearchableSelect(
  page: Page,
  trigger: string,
  placeholder: string,
  query: string,
  option: RegExp
) {
  const search = page.getByPlaceholder(placeholder);

  await expect(async () => {
    await page.getByRole('button', { name: trigger }).click();
    await expect(search).toBeFocused({ timeout: 2000 });
  }).toPass({ timeout: 20000 });

  await search.fill(query);
  await page.getByRole('option', { name: option }).first().click();
}

test('a parent can report a missed class and see it appear in the recent list', async ({
  page,
}) => {
  await page.goto('/');

  await pickFromSearchableSelect(
    page,
    'Établissement',
    'Rechercher',
    'Collège Georges Brassens',
    /Collège Georges Brassens/
  );

  // A collège, so the dropdown offers the four collège levels and nothing else —
  // see the cycle test below.
  await page.locator('#sel-class').click();
  await page.getByRole('option', { name: '3e', exact: true }).click();

  await page.getByRole('radio', { name: 'Groupe C, ou 3' }).click();

  await pickFromSearchableSelect(
    page,
    'Discipline',
    'Rechercher une discipline',
    'mathe',
    /Mathématiques/
  );

  // The calendar caps at today, so today is always a valid pick.
  await page.getByRole('button', { name: 'Date' }).click();
  await page.locator('[data-today]').first().click();

  await page.getByRole('radio', { name: '3 heures' }).click();

  const submit = page.getByRole('button', { name: /Envoyer le signalement/ });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText("Merci, c'est enregistré")).toBeVisible();

  // The real assertion: the report came back *from the store* through `load`,
  // not from client state left over after the submit.
  const report = page.getByRole('listitem').filter({ hasText: 'Georges Brassens' });
  await expect(report).toBeVisible();
  await expect(report).toContainText('3e C');
  await expect(report).toContainText('Mathématiques');
  await expect(report).toContainText('3h');
});

test('future dates are rejected', async ({ page }) => {
  await page.goto('/');

  await pickFromSearchableSelect(
    page,
    'Établissement',
    'Rechercher',
    'Collège Georges Brassens',
    /Collège Georges Brassens/
  );

  await page.locator('#sel-class').click();
  await page.getByRole('option', { name: '3e', exact: true }).click();

  // Select today's date (calendar picker allows it)
  await page.getByRole('button', { name: 'Date' }).click();
  await page.locator('[data-today]').first().click();

  // Fill hours to enable submit
  await page.getByRole('radio', { name: '3 heures' }).click();

  // Now override the hidden date input with a future date
  // (the UI prevents future dates, but we test server-side validation)
  await page.evaluate(() => {
    const dateInput = document.querySelector<HTMLInputElement>('input[name="date"]');
    if (dateInput) {
      dateInput.value = '2099-12-31';
    }
  });

  const submit = page.getByRole('button', { name: /Envoyer le signalement/ });
  await submit.click();

  // Should show an error about date bounds
  await expect(page.getByText(/La date doit être valide/)).toBeVisible();
});

test('the class dropdown follows the school that was picked', async ({ page }) => {
  await page.goto('/');

  // Located by id, not by accessible name: the trigger's text *is* the current
  // selection, so a name-based locator would stop matching the moment a class is
  // chosen.
  const classTrigger = page.locator('#sel-class');
  const cm2 = page.getByRole('option', { name: 'CM2', exact: true });
  const premiere = page.getByRole('option', { name: '1ère', exact: true });

  // No school yet, so nothing to infer from: every cycle is on offer. The retry
  // waits out hydration, exactly as `pickFromSearchableSelect` does.
  await expect(async () => {
    await classTrigger.click();
    await expect(cm2).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(premiere).toBeVisible();

  await cm2.click();
  await expect(classTrigger).toHaveText('CM2');

  await pickFromSearchableSelect(
    page,
    'Établissement',
    'Rechercher',
    'Collège Georges Brassens',
    /Collège Georges Brassens/
  );

  // A collège has no CM2, so the pick can't stand — the form goes back to asking
  // for a class rather than quietly posting one the school cannot have.
  await expect(classTrigger).toHaveText('Sélectionner une classe');

  await classTrigger.click();
  await expect(page.getByRole('option', { name: '3e', exact: true })).toBeVisible();
  await expect(cm2).toHaveCount(0);
  await expect(premiere).toHaveCount(0);
});
