import { fetchGzipJson } from '$lib/gzip-json';
import type { School } from '$lib/types/school';

/**
 * The browser-side cache for the full school registry.
 *
 * The registry is ~2.5 MB gzipped and identical for every caller, so it is
 * fetched at most once per page load however many things ask for it. Hoisting
 * it out of `MapMain` is what lets the download *start* before the map is
 * mounted: `CardReport` calls `preloadSchools()` as soon as someone reaches for
 * the « Carte » tab, and by the time the component mounts and calls
 * `loadSchools()` the request is already in flight — or finished.
 *
 * Module state, so it lives as long as the page. That is the right scope here:
 * the data is public, immutable for the session, and shared by every consumer.
 */
let cached: School[] | null = null;
let inflight: Promise<School[]> | null = null;

/**
 * The registry if it is already here, `null` otherwise. Never starts a request.
 *
 * Exists so a component can render its ready state on the *first* frame instead
 * of flashing a spinner: `await` on an already-resolved promise still costs a
 * microtask, which is long enough for one paint of the wrong thing.
 */
export function cachedSchools(): School[] | null {
  return cached;
}

/**
 * The registry, fetching it if necessary.
 *
 * Concurrent callers share one request rather than racing: the promise is
 * memoised, not the result, so a second caller arriving mid-flight waits on the
 * same fetch instead of starting a second 2.5 MB download.
 */
export function loadSchools(): Promise<School[]> {
  if (cached) return Promise.resolve(cached);

  inflight ??= fetchGzipJson<School[]>('/api/schools')
    .then((schools) => {
      cached = schools;

      return schools;
    })
    .catch((error: unknown) => {
      // Clear the memo before rethrowing, or one flaky network moment would be
      // cached as a permanent failure and every retry would replay it.
      inflight = null;

      throw error;
    });

  return inflight;
}

/**
 * Start the download without waiting for it or caring whether it worked.
 *
 * Called from a hover or a focus, where there is no UI to report an error to and
 * nothing to do about one — whoever actually needs the data calls `loadSchools()`
 * and handles the failure there, on a fresh attempt. The `catch` is not
 * optional: an unhandled rejection from a speculative prefetch would surface in
 * the console as if something were broken.
 */
export function preloadSchools(): void {
  void loadSchools().catch(() => {});
}

/** Drop the cache. For testing only. */
export function resetSchoolsCache(): void {
  cached = null;
  inflight = null;
}
