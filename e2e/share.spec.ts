import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The share dialog is the one thing on the site whose *output* is a link other
 * people follow, so what these tests really pin is `shareUrl`'s rule as it
 * reaches the screen: what travels, and what is stripped on the way.
 *
 * They read the readonly field rather than the clipboard on purpose. Clipboard
 * access is a per-browser permission grant in Playwright — Chromium-only in
 * practice — and the field is the fallback that has to work anyway when
 * `navigator.clipboard` is missing outside a secure context.
 */

const SHARED_LINK = 'Lien à partager';

/**
 * Clicks a trigger until the dialog is actually up.
 *
 * The same hydration race `pickFromSearchableSelect` in `report.spec.ts`
 * documents: the trigger is server-rendered, so a click can land on a live
 * button before Svelte has attached anything to it and simply do nothing. The
 * page exposes no "hydrated" event to wait on, so retrying is the answer.
 */
async function open(trigger: Locator) {
  const dialog = trigger.page().getByRole('dialog');

  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });

  return dialog;
}

/**
 * The icon button at the end of the navbar's row of links. Scoped to the
 * landmark rather than picked with `.first()`: both triggers are called
 * "Partager", and an order-dependent locator would silently start testing the
 * footer the day someone reorders the layout.
 */
const navbarTrigger = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button');

/** The footer link — a <button>, since it opens a dialog rather than navigating. */
const footerTrigger = (page: Page) =>
  page.getByRole('contentinfo').getByRole('button', { name: 'Partager' });

test('the navbar button opens the dialog with a QR code and the page link', async ({
  page,
  baseURL,
}) => {
  await page.goto('/');
  await open(navbarTrigger(page));

  await expect(page.getByRole('heading', { name: 'Partager ViteMonProf' })).toBeVisible();
  await expect(page.getByLabel(SHARED_LINK)).toHaveValue(`${baseURL}/`);

  // `role="img"` plus the accessible name is the whole contract `QrCode.svelte`
  // offers a screen reader; if it renders as an anonymous <svg> that is a bug
  // even though the pixels are identical.
  await expect(page.getByRole('img', { name: `Code QR vers ${baseURL}/` })).toBeVisible();
});

test('the footer link opens the same dialog', async ({ page }) => {
  await page.goto('/about');
  await open(footerTrigger(page));

  await expect(page.getByLabel(SHARED_LINK)).toHaveValue(/\/about$/);
});

test('a filtered dashboard shares its filters', async ({ page, baseURL }) => {
  // The point of encoding the current URL rather than the homepage: « voici le
  // classement de mon département » has to survive being handed to someone.
  await page.goto('/dashboard?departement=75&dimension=discipline');
  await open(navbarTrigger(page));

  await expect(page.getByLabel(SHARED_LINK)).toHaveValue(
    `${baseURL}/dashboard?departement=75&dimension=discipline`
  );
});

test('?submitted does not travel', async ({ page, baseURL }) => {
  // Sharing this verbatim would thank the recipient for a report they never
  // filed — the no-JS confirmation banner keys off exactly this parameter.
  await page.goto('/?submitted=1');
  await open(navbarTrigger(page));

  await expect(page.getByLabel(SHARED_LINK)).toHaveValue(`${baseURL}/`);
});

test('the dialog closes on Escape', async ({ page }) => {
  await page.goto('/');
  const dialog = await open(navbarTrigger(page));

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
});

test('the link can be copied to the clipboard', async ({ page, baseURL, context }) => {
  // Chromium-only, hence the one test that is allowed to know about the
  // clipboard at all; everything else asserts the field.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await open(navbarTrigger(page));

  await page.getByRole('button', { name: 'Copier le lien' }).click();

  await expect(page.getByRole('button', { name: 'Lien copié' })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(`${baseURL}/`);
});
