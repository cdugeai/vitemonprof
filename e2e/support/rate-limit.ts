import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Empties the server's rate-limit buckets.
 *
 * Call it from a `beforeEach` in any spec that submits the report form. The quota
 * is per-IP and the whole run shares one IP, so a spec that doesn't reset inherits
 * whatever the previous one spent — see `src/routes/api/test/reset-rate-limit`.
 *
 * The status is asserted rather than ignored: if the hook ever stops being wired
 * up, the failure should name *that*, not resurface a minute later as an
 * unexplained 429 in an unrelated assertion.
 */
export async function resetRateLimit(request: APIRequestContext) {
  const response = await request.post('/api/test/reset-rate-limit');
  expect(response.status(), 'rate-limit reset hook should be enabled').toBe(204);
}
