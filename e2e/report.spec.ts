import { expect, test, type Page } from '@playwright/test';

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
    'Georges Brassens',
    /Georges Brassens/
  );

  await page.getByRole('button', { name: 'Classe' }).click();
  await page.getByRole('option', { name: '1ère', exact: true }).click();

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

  const submit = page.getByRole('button', { name: /Envoyer le rapport/ });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText('Rapport enregistré')).toBeVisible();

  // The real assertion: the report came back *from the store* through `load`,
  // not from client state left over after the submit.
  const report = page.getByRole('listitem').filter({ hasText: 'Georges Brassens' });
  await expect(report).toBeVisible();
  await expect(report).toContainText('1ère C');
  await expect(report).toContainText('Mathématiques');
  await expect(report).toContainText('3h');
});
