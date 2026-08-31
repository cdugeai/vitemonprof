import { expect, test } from '@playwright/test';

// The page is a legal obligation, not a feature: what matters is that it is *reachable*
// from anywhere on the site and that the mandatory blocks are actually rendered. Both
// assertions are here to catch the two ways it silently stops satisfying the LCEN — the
// footer link being dropped in a redesign, or the hébergeur block being edited away.
test('the mentions légales page is reachable from the footer of any page', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByRole('link', { name: 'Mentions légales' }).click();

  await expect(page).toHaveURL('/mentions-legales');
  await expect(page.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeVisible();
});

test('the page names the publisher, the host, and a contact address', async ({ page }) => {
  await page.goto('/mentions-legales');

  await expect(page.getByRole('heading', { name: 'Éditeur du site' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Directeur de la publication' })).toBeVisible();
  await expect(page.getByText('Vercel Inc.')).toBeVisible();
  await expect(page.getByRole('link', { name: /@/ }).first()).toHaveAttribute(
    'href',
    /^mailto:.+@.+/
  );
});
