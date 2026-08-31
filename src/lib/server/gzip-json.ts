import { gzip } from 'pako';
import { GZIP_JSON_CONTENT_TYPE } from '$lib/gzip-json';

/** Deflate level: 6 is zlib's default — the knee of the ratio/CPU curve. */
const COMPRESSION_LEVEL = 6;

/**
 * Serialize `value` to JSON and gzip it.
 *
 * Returns the bytes rather than a `Response` so callers can cache the compressed
 * buffer: compressing the full school registry is expensive enough that redoing it
 * per request would dominate the response time.
 */
export function gzipJson(value: unknown): Uint8Array<ArrayBuffer> {
  return gzip(JSON.stringify(value), { level: COMPRESSION_LEVEL });
}

/** Wrap already-gzipped bytes in a `Response` that `fetchGzipJson` can read. */
export function gzipJsonResponse(bytes: Uint8Array<ArrayBuffer>): Response {
  return new Response(bytes, {
    headers: {
      'content-type': GZIP_JSON_CONTENT_TYPE,
      'content-length': String(bytes.byteLength),
    },
  });
}
