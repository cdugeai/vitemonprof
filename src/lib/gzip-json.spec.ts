import { describe, expect, it } from 'vitest';
import { GZIP_JSON_CONTENT_TYPE, ungzipJson } from './gzip-json';
import { gzipJson, gzipJsonResponse } from './server/gzip-json';

describe('gzip-json', () => {
  it('round-trips a value through a Response', async () => {
    const value = { schools: [{ id: 'a', name: 'École élémentaire Émile Zola' }] };

    const decoded = await ungzipJson<typeof value>(gzipJsonResponse(gzipJson(value)));

    expect(decoded).toEqual(value);
  });

  it('labels the body as a gzip payload, not a transfer encoding', () => {
    const res = gzipJsonResponse(gzipJson([1, 2, 3]));

    expect(res.headers.get('content-type')).toBe(GZIP_JSON_CONTENT_TYPE);
    // A `Content-Encoding` here would make the browser inflate it behind our back.
    expect(res.headers.get('content-encoding')).toBeNull();
  });

  it('actually shrinks a repetitive payload', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ id: `UAI${i}`, city: 'Paris' }));

    const bytes = gzipJson(rows);

    expect(bytes.byteLength).toBeLessThan(JSON.stringify(rows).length / 5);
  });
});
