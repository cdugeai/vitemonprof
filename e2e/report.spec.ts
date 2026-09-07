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

  // The acknowledgement is a toast. Asserting it *inside* the toaster region, and that
  // the phrase appears exactly once, is what keeps the no-JS fallback alert from quietly
  // satisfying this test — with JS the two must never both be on screen.
  await expect(page.getByLabel(/Notifications/).getByText("Merci, c'est enregistré")).toBeVisible();
  await expect(page.getByText("Merci, c'est enregistré")).toHaveCount(1);

  // `use:enhance` handles the success off the action result and never follows the 303, so
  // the no-JS flash never reaches the address bar — a refresh here re-loads a plain `/`.
  await expect(page).toHaveURL('/');

  // The real assertion: the report came back *from the store* through `load`,
  // not from client state left over after the submit.
  const report = page.getByRole('listitem').filter({ hasText: 'Georges Brassens' });
  await expect(report).toBeVisible();
  await expect(report).toContainText('3e C');
  await expect(report).toContainText('Mathématiques');
  await expect(report).toContainText('3h');
});

// Not navigating on success is what keeps `?submitted` out of the URL, and it costs the
// re-render that used to refresh the hidden inputs from component state — which is only
// visible on a *second* submit, hence this test rather than a comment. It also pins the
// division of labour between the two failure surfaces: with JS a rejection is a toast and
// nothing else.
test('a rejection is a toast, and the next report still goes through', async ({ page }) => {
  await page.goto('/');

  // Deliberately *not* Georges Brassens: the first test asserts that exactly one recent
  // report matches that school, and the rows this test files would break it on any run
  // that reuses a still-running dev server — `reuseExistingServer` keeps the in-memory
  // store alive between local runs.
  await pickFromSearchableSelect(page, 'Établissement', 'Rechercher', 'Jean Moulin', /Jean Moulin/);
  await page.getByRole('button', { name: 'Classe' }).click();
  await page.getByRole('option', { name: '2nde', exact: true }).click();
  await page.getByRole('button', { name: 'Date' }).click();
  await page.locator('[data-today]').first().click();
  await page.getByRole('radio', { name: '4 heures' }).click();

  const submit = page.getByRole('button', { name: /Envoyer le signalement/ });
  await submit.click();
  await expect(page.getByLabel(/Notifications/).getByText("Merci, c'est enregistré")).toBeVisible();

  // Byte-for-byte the same report, inside the two-minute window: the duplicate guard
  // rejects it, which is the cheapest way to get a failure on screen.
  await submit.click();
  const errorToast = page
    .getByLabel(/Notifications/)
    .getByText("Le signalement n'a pas pu être envoyé");
  await expect(errorToast).toBeVisible();
  await expect(page.getByText('Vous avez déjà effectué ce signalement.')).toBeVisible();

  // The failure is a toast and *only* a toast: `update()` is skipped precisely so the
  // page's own alert — the no-JS fallback — doesn't say it a second time.
  await expect(page.getByRole('alert').filter({ hasText: 'pas pu être envoyé' })).toHaveCount(0);

  // One field different, so it's a new claim. This only succeeds if the hidden inputs
  // still carry the school and class picked before the first submit.
  await page.getByRole('radio', { name: '2 heures' }).click();
  await submit.click();

  await expect(page.getByLabel(/Notifications/).getByText("Merci, c'est enregistré")).toBeVisible();
});

// The toast needs JS. The `?submitted` flash in the URL is what carries the confirmation
// to everyone else, and this is the only place that exercises it: with scripting off,
// nothing scrubs the param, so the server-rendered alert has to stand on its own.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the redirect still confirms the submission', async ({ page }) => {
    await page.goto('/?submitted');
    await expect(page.getByRole('alert').getByText("Merci, c'est enregistré")).toBeVisible();
  });

  test('a plain page carries no confirmation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText("Merci, c'est enregistré")).toHaveCount(0);
  });
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
