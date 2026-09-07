import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { School } from '$lib/types/school';
import { cachedSchools, loadSchools, preloadSchools, resetSchoolsCache } from './schools-cache';

const SCHOOL: School = {
  id: '0761322Z',
  name: 'Lycée professionnel Claude Monet',
  address: '1 rue de la Gare',
  city: 'LE HAVRE',
  postalCode: '76085',
  departement: '76',
  latitude: 49.4938,
  longitude: 0.1077,
};

/**
 * `/api/schools` answers with gzip bytes, not JSON, so the fake has to as well —
 * `fetchGzipJson` inflates whatever comes back and would throw on a plain body.
 * Compressing a one-element array is cheap and keeps the module under test
 * unmocked, which is the point: what is being tested is that one 2.5 MB request
 * happens once, and stubbing `fetchGzipJson` would test the stub instead.
 */
async function gzipResponse(value: unknown): Promise<Response> {
  const { gzip } = await import('pako');
  const bytes = gzip(JSON.stringify(value));

  return new Response(bytes as unknown as BodyInit, { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetSchoolsCache();
  fetchMock = vi.fn(async () => gzipResponse([SCHOOL]));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadSchools', () => {
  it('fetches the registry and returns it', async () => {
    expect(await loadSchools()).toEqual([SCHOOL]);
  });

  it('fetches once, however many callers there are', async () => {
    await loadSchools();
    await loadSchools();
    await loadSchools();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one request between callers that arrive mid-flight', async () => {
    // The memo holds the *promise*, not the result, so three simultaneous
    // callers must not start three 2.5 MB downloads.
    const [a, b, c] = await Promise.all([loadSchools(), loadSchools(), loadSchools()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual([[SCHOOL], [SCHOOL], [SCHOOL]]);
  });

  it('rejects when the request fails', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));

    await expect(loadSchools()).rejects.toThrow(/500/);
  });

  it('retries after a failure instead of caching it', async () => {
    // A memoised rejection would turn one flaky moment into a permanent
    // failure, and the retry button in `MapMain` would do nothing at all.
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));

    await expect(loadSchools()).rejects.toThrow();
    expect(await loadSchools()).toEqual([SCHOOL]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('cachedSchools', () => {
  it('is null before anything is loaded, and never starts a request', () => {
    expect(cachedSchools()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the registry synchronously once it has arrived', async () => {
    await loadSchools();

    // What lets `MapMain` render its ready state on the first frame: awaiting an
    // already-resolved promise still costs a microtask, which is one paint of a
    // spinner nobody needed to see.
    expect(cachedSchools()).toEqual([SCHOOL]);
  });

  it('stays null while a request is still in flight', () => {
    void loadSchools();

    expect(cachedSchools()).toBeNull();
  });
});

describe('preloadSchools', () => {
  it('starts the request', () => {
    preloadSchools();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the result where a later loadSchools finds it', async () => {
    preloadSchools();

    expect(await loadSchools()).toEqual([SCHOOL]);
    // The whole point of preloading on hover: the click must not start a second
    // download, it must join the one already running.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('swallows failures rather than raising an unhandled rejection', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));

    // A speculative prefetch has no UI to report to. An unhandled rejection here
    // would show up in the console as though something were broken.
    expect(() => preloadSchools()).not.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });
});
