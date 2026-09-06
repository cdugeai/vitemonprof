import { expect, test } from '@playwright/test';

test('the page renders the report form and the recent-reports panel', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /suivi des absences de courte durée/i })
  ).toBeVisible();
  await expect(page.getByText('Signaler une heure non remplacée')).toBeVisible();
  await expect(page.getByText('Signalements récents')).toBeVisible();
});

test('submitting is blocked until the required fields are filled', async ({ page }) => {
  await page.goto('/');

  // The hint and the disabled button share one rule (`canSubmitForm`), so this
  // asserts they agree rather than testing either in isolation.
  await expect(page.getByRole('button', { name: /Envoyer le signalement/ })).toBeDisabled();
  await expect(page.getByText('Choisissez un établissement')).toBeVisible();
});
