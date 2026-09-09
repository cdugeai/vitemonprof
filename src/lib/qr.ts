import { encode } from 'uqr';

export interface QrSvg {
  /** Width and height of the code in modules, excluding any quiet zone. */
  size: number;
  /** An SVG path, in a coordinate system where one module is one unit. */
  path: string;
}

/**
 * Turn a string into the geometry of a QR code.
 *
 * Not `uqr`'s own `renderSVG()`, for three reasons, in order of weight:
 *
 * 1. It returns markup, which would force `{@html}` into the component. A path
 *    string is data, so `QrCode.svelte` stays ordinary Svelte.
 * 2. One `<path>` beats the several hundred `<rect>`s a module-per-element
 *    renderer produces.
 * 3. A string is testable. Vitest here only runs a node project — `*.svelte`
 *    components have no test environment — so putting the geometry in a plain
 *    module is what makes any of this assertable at all. Same split as
 *    `schoolSearch.ts` versus `SelectorSchool.svelte`.
 *
 * The caller supplies the quiet zone (see `QrCode.svelte`), hence `border: 0`:
 * `encode` otherwise pads `data` with a one-module margin, which would make
 * `size` mean two different things depending on who asked.
 */
export function qrSvgPath(text: string): QrSvg {
  // 'M' recovers 15% of a damaged code, against 7% for uqr's default 'L'. This
  // one is read off a screen from across a table, through glare and at an angle,
  // and the cost is a slightly denser grid.
  const { size, data } = encode(text, { ecc: 'M', border: 0 });

  const parts: string[] = [];

  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!data[row][col]) {
        col++;
        continue;
      }
      // Consume the whole horizontal run at once. A QR is full of them —
      // timing patterns, finders, alignment squares — so drawing one rectangle
      // per run instead of one per module roughly halves the path string.
      const start = col;
      while (col < size && data[row][col]) col++;
      const run = col - start;
      parts.push(`M${start} ${row}h${run}v1h-${run}z`);
    }
  }

  return { size, path: parts.join('') };
}
