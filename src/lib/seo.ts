/**
 * Site-wide defaults for the metadata in `Seo.svelte`.
 *
 * These live in a module rather than as component defaults so a page can reuse a
 * single piece — a description that appends to the site one, say — without pulling
 * in the component's whole prop shape.
 */

export const SITE_NAME = 'ViteMonProf';

/**
 * The fallback `<meta name="description">` and `og:description`.
 *
 * Kept under ~160 characters: Google truncates the snippet around there, and so do
 * the link previews in WhatsApp, Slack and iMessage. `e2e/seo.spec.ts` asserts the
 * bound on every page, because a description silently cut mid-word is the kind of
 * thing nobody notices until it has been shared.
 */
export const SITE_DESCRIPTION =
  'ViteMonProf recense les heures de cours non remplacées signalées par les familles, ' +
  'élèves et personnels, dans votre établissement et partout en France.';

/**
 * The image every link preview falls back to.
 *
 * It lives in `static/` rather than being imported through Vite on purpose: an
 * imported asset gets a content hash in its URL, and social crawlers cache
 * aggressively by URL. A stable path means a preview that has already been
 * scraped keeps working across deploys.
 *
 * 1200×630 is the size Facebook, LinkedIn and X all render at 1.91:1 without
 * re-cropping. The dimensions are declared as tags too — a crawler that has not
 * fetched the image yet can lay the card out from them, which is what stops the
 * first share of a page from showing a small "summary" card instead of a large one.
 */
export const OG_IMAGE = {
  path: '/og-image.jpg',
  width: 1200,
  height: 630,
  alt: "Page d'accueil de ViteMonProf : le formulaire de signalement d'une heure non remplacée.",
} as const;
