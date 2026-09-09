import { describe, expect, it } from 'vitest';
import { shareUrl } from './shareUrl';

const share = (href: string) => shareUrl(new URL(href));

describe('shareUrl', () => {
  it('leaves an ordinary page URL alone', () => {
    expect(share('https://vitemonprof.fr/about')).toBe('https://vitemonprof.fr/about');
  });

  it('keeps the dashboard filters', () => {
    // The reason this function exists rather than reusing the SEO canonical:
    // the filters *are* what is being shared.
    expect(share('https://vitemonprof.fr/dashboard?departement=75&dimension=discipline')).toBe(
      'https://vitemonprof.fr/dashboard?departement=75&dimension=discipline'
    );
  });

  it('drops ?submitted', () => {
    // Otherwise the recipient is thanked for a report they never filed.
    expect(share('https://vitemonprof.fr/?submitted=1')).toBe('https://vitemonprof.fr/');
  });

  it('drops ?submitted without taking its neighbours', () => {
    expect(share('https://vitemonprof.fr/dashboard?submitted=1&departement=25')).toBe(
      'https://vitemonprof.fr/dashboard?departement=25'
    );
  });

  it('drops the fragment', () => {
    expect(share('https://vitemonprof.fr/about#contact')).toBe('https://vitemonprof.fr/about');
  });

  it('leaves an untouched query byte-for-byte', () => {
    // `URLSearchParams` re-encodes a space as `+` the moment anything writes to
    // it, so a no-op pass must not write. A link that differs from the address
    // bar it was copied from looks broken even when it resolves.
    expect(share('https://vitemonprof.fr/dashboard?q=a%20b')).toBe(
      'https://vitemonprof.fr/dashboard?q=a%20b'
    );
  });

  it('does not leak the origin it was given', () => {
    // Dev, preview and production each share themselves — there is no hardcoded
    // domain here, the same way `Seo.svelte` derives its canonical from the
    // request.
    expect(share('http://localhost:5173/dashboard')).toBe('http://localhost:5173/dashboard');
  });
});
