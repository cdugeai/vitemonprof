import { describe, expect, it } from 'vitest';
import { encode } from 'uqr';
import { qrSvgPath } from './qr';

const HOME = 'https://vitemonprof.fr/';
const FILTERED = 'https://vitemonprof.fr/dashboard?departement=75&dimension=discipline';

/**
 * These pin the *contract* — the size, the corners, the path grammar — and never
 * the exact path string. That would pin uqr's choice of mask pattern, which is
 * an implementation detail it is free to change in a patch release.
 */
describe('qrSvgPath', () => {
  it('sizes the grid to a real QR version', () => {
    const { size } = qrSvgPath(HOME);

    // Version n is 17 + 4n modules across, so every legal size is odd and at
    // least 21. A size of 27 here would mean the quiet zone leaked back in.
    expect(size).toBeGreaterThanOrEqual(21);
    expect(size % 2).toBe(1);
    expect((size - 17) % 4).toBe(0);
  });

  it('excludes the quiet zone, unlike uqr default', () => {
    // The whole reason `qr.ts` passes `border: 0`: `encode`'s default pads the
    // grid, and a component that then adds its own margin would double it.
    const bordered = encode(HOME, { ecc: 'M', border: 1 });

    expect(qrSvgPath(HOME).size).toBe(bordered.size - 2);
  });

  it('draws the three finder patterns', () => {
    const { size, path } = qrSvgPath(HOME);

    // Every QR opens each finder with a solid 7-module run, at the top-left,
    // top-right and bottom-left corners. If the rows and columns were ever
    // transposed, or the run-length merge dropped a run, these would go.
    expect(path).toContain('M0 0h7v1h-7z');
    expect(path).toContain(`M${size - 7} 0h7v1h-7z`);
    expect(path).toContain(`M0 ${size - 7}h7v1h-7z`);
  });

  it('emits nothing but rectangles', () => {
    // One `M x y h n v1 h-n z` per horizontal run, and no other command: an
    // arc or a curve would mean the builder had gone wrong somewhere.
    expect(qrSvgPath(HOME).path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });

  it('grows with the length of the payload', () => {
    // What makes `shareUrl` keeping the dashboard's query a real cost rather
    // than a free one — worth knowing it is bounded and not a jump to v40.
    expect(qrSvgPath(FILTERED).size).toBeGreaterThan(qrSvgPath(HOME).size);
    expect(qrSvgPath(FILTERED).size).toBeLessThanOrEqual(45);
  });

  it('is deterministic', () => {
    expect(qrSvgPath(HOME).path).toBe(qrSvgPath(HOME).path);
  });
});
