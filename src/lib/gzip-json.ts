import { ungzip } from 'pako';

/**
 * Gzipped JSON, moved as a *payload* rather than as a transfer encoding.
 *
 * The obvious alternative is `Content-Encoding: gzip`, and it is the right answer
 * most of the time: the browser inflates it for free and `res.json()` keeps working.
 * That is exactly why it can't be used here — the moment a response is labelled with
 * `Content-Encoding`, the browser (and every proxy in between) decompresses it before
 * our code sees a byte, so a `pako.ungzip` on the client would be handed plain JSON
 * and throw. Encoding is the transport's business; a body we compress and decompress
 * ourselves is content, so it gets a `Content-Type` instead.
 *
 * Worth knowing for later: browsers ship `DecompressionStream('gzip')` natively
 * (Chrome 80+, Firefox 113+, Safari 16.4+), which would do this half with no bundle
 * cost at all. pako is what covers the older browsers `vite.config.ts` still targets
 * (safari15 / ios15).
 *
 * Compression lives in `$lib/server/gzip-json` — a separate module on purpose, so the
 * client chunk only ever pulls pako's inflate half in.
 */
export const GZIP_JSON_CONTENT_TYPE = 'application/gzip';

/** Inflate a gzipped-JSON body and parse it. Mirrors `res.json()`, one level down. */
export async function ungzipJson<T>(res: Response): Promise<T> {
  // pako 3 takes the ArrayBuffer as-is, and `toText` decodes the result as UTF-8
  // (it replaced pako 2's `{ to: 'string' }`, which is silently ignored now).
  const text = ungzip(await res.arrayBuffer(), { toText: true });

  return JSON.parse(text) as T;
}

/** `fetch` + `ungzipJson`, i.e. the gzipped counterpart of `fetch(...).then((r) => r.json())`. */
export async function fetchGzipJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);

  if (!res.ok) {
    throw new Error(`GET ${input} failed: ${res.status}`);
  }

  return ungzipJson<T>(res);
}
