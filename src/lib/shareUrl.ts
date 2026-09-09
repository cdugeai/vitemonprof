/**
 * The link to hand to someone else.
 *
 * Deliberately *not* the canonical URL that `Seo.svelte` builds. That one drops
 * the query string so `?submitted=1` cannot split the canonical signal across
 * two URLs for the same document. Sharing wants the opposite: the whole point of
 * sharing `/dashboard` is to share the view you are looking at, filters and all
 * — `?departement=75&dimension=discipline` is the message.
 *
 * The two rules only look alike; keeping them in separate functions is what
 * stops a change to one from silently rewriting the other.
 */

/**
 * Query parameters that describe *this visit* rather than the page, and so must
 * not travel. `submitted` is set by the no-JS Post/Redirect/Get in
 * `+page.server.ts`; forwarding it would greet the recipient with a thank-you
 * toast for a report they never filed.
 */
const TRANSIENT_PARAMS = ['submitted'];

/**
 * @param url The current page URL — `page.url` from `$app/state`.
 * @returns An absolute URL: same origin and path, meaningful query kept,
 *   transient query and hash dropped.
 */
export function shareUrl(url: URL): string {
  // Copy rather than mutate: `page.url` is SvelteKit's, and in a `$derived` this
  // runs again on every navigation.
  const shared = new URL(url.href);

  // A fragment says where you were on the page, not what the page is.
  shared.hash = '';

  // `has` before `delete` is not a micro-optimisation. Touching `searchParams`
  // at all re-serialises the whole query through `URLSearchParams`, which spells
  // a space `+` where the address bar had `%20`. The two decode the same, but a
  // link that does not match what the sender sees reads like a mistake — and it
  // is pure noise in a QR code, which pays for every character.
  for (const param of TRANSIENT_PARAMS) {
    if (shared.searchParams.has(param)) shared.searchParams.delete(param);
  }

  return shared.href;
}
