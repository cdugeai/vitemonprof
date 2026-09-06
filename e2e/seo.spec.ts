import { expect, test, type Page } from '@playwright/test';

/**
 * Every metadata assertion here reads the *served HTML* rather than the DOM, and
 * that is the whole point of testing this at all. A link preview is built by a
 * crawler that never runs JavaScript: Facebook, WhatsApp, Slack and X fetch the
 * document and parse it. A tag that only appears after hydration is a tag no
 * crawler will ever see, so `page.locator(...)` — which reads the live DOM — would
 * happily pass on markup that produces a blank card in the wild.
 */
async function metaFromServedHtml(page: Page, path: string) {
  const response = await page.request.get(path);
  expect(response.status()).toBe(200);
  const html = await response.text();

  const attr = (selector: RegExp) => html.match(selector)?.[1];

  return {
    title: html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1],
    description: attr(/<meta name="description" content="([^"]*)"/),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/),
    robots: attr(/<meta name="robots" content="([^"]*)"/),
    ogType: attr(/<meta property="og:type" content="([^"]*)"/),
    ogUrl: attr(/<meta property="og:url" content="([^"]*)"/),
    ogTitle: attr(/<meta property="og:title" content="([^"]*)"/),
    ogDescription: attr(/<meta property="og:description" content="([^"]*)"/),
    ogImage: attr(/<meta property="og:image" content="([^"]*)"/),
    ogImageWidth: attr(/<meta property="og:image:width" content="([^"]*)"/),
    ogImageHeight: attr(/<meta property="og:image:height" content="([^"]*)"/),
    ogSiteName: attr(/<meta property="og:site_name" content="([^"]*)"/),
    twitterCard: attr(/<meta name="twitter:card" content="([^"]*)"/),
  };
}

const PAGES = ['/', '/about', '/dashboard', '/mentions-legales'] as const;

for (const path of PAGES) {
  test(`${path} serves a complete Open Graph card`, async ({ page, baseURL }) => {
    const meta = await metaFromServedHtml(page, path);

    expect(meta.ogType).toBe('website');
    expect(meta.ogSiteName).toBe('ViteMonProf');
    expect(meta.twitterCard).toBe('summary_large_image');

    // `og:title` and `og:description` mirror the document's own — a card that
    // disagrees with the page it links to is worse than no card.
    expect(meta.ogTitle).toBe(meta.title);
    expect(meta.ogDescription).toBe(meta.description);

    // Absolute, because a crawler resolves nothing relative: a bare
    // `/og-image.jpg` is silently dropped and the card renders imageless.
    expect(meta.ogImage).toBe(`${baseURL}/og-image.jpg`);
    expect(meta.ogUrl).toBe(`${baseURL}${path === '/' ? '/' : path}`);
    expect(meta.canonical).toBe(meta.ogUrl);

    // Declared so the first scrape can lay out a large card before it has
    // fetched the file. They have to match the real image, hence the fetch below.
    expect(meta.ogImageWidth).toBe('1200');
    expect(meta.ogImageHeight).toBe('630');
  });

  test(`${path} has a description within the snippet budget`, async ({ page }) => {
    const meta = await metaFromServedHtml(page, path);

    expect(meta.description).toBeTruthy();
    // Search results and link previews truncate around 160 characters; below ~80
    // the card looks unfinished. Both ends are cheap to get wrong when a page's
    // copy is edited and its metadata is not.
    expect(meta.description!.length).toBeGreaterThan(80);
    expect(meta.description!.length).toBeLessThanOrEqual(165);
  });
}

test('the og:image URL actually resolves at the declared size', async ({ page }) => {
  const { ogImage } = await metaFromServedHtml(page, '/');

  const response = await page.request.get(ogImage!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/jpeg');

  // Reading the size out of the JPEG rather than trusting the tags: the file
  // lives in `static/` and can be replaced without anyone touching `seo.ts`, and
  // dimensions that lie make the card crop badly on LinkedIn and X.
  const { width, height } = jpegSize(await response.body());
  expect({ width, height }).toEqual({ width: 1200, height: 630 });
});

/**
 * Minimal JPEG dimension reader: walk the segment markers to the start-of-frame
 * (SOFn), whose payload carries height then width as big-endian 16-bit values.
 */
function jpegSize(buffer: Buffer): { width: number; height: number } {
  let offset = 2; // skip SOI
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error('not a JPEG segment');
    const marker = buffer[offset + 1];
    // SOF0–SOF15, excluding the non-frame markers DHT (c4), JPGA (c8) and DAC (cc).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  throw new Error('no SOF marker found');
}

test('only the pages worth indexing are indexable', async ({ page }) => {
  // No `robots` tag at all is the indexable default — asserting its absence is
  // what catches a stray `noindex` copied onto a page that wants traffic.
  expect((await metaFromServedHtml(page, '/')).robots).toBeUndefined();
  expect((await metaFromServedHtml(page, '/dashboard')).robots).toBeUndefined();

  expect((await metaFromServedHtml(page, '/mentions-legales')).robots).toBe('noindex, follow');
});
