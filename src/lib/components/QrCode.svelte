<script lang="ts">
  import { qrSvgPath } from '$lib/qr';
  import { cn } from '$lib/utils';

  interface Props {
    /** The text the code encodes — here, always an absolute URL. */
    value: string;
    /** Accessible name. A QR is opaque, so say where it goes. */
    label: string;
    class?: string;
  }

  let { value, label, class: className }: Props = $props();

  const qr = $derived(qrSvgPath(value));

  /**
   * The quiet zone: four all-light modules on every side, which the QR spec
   * requires and scanners really do need to lock on. Expressing it in the
   * viewBox rather than in markup means it costs nothing and cannot drift out
   * of step with the grid.
   */
  const QUIET = 4;
</script>

<!--
  Black on white, hardcoded, not theme tokens. The page background is beige
  (`--mybeige-bg`) and a scanner wants unambiguous contrast: this is a barcode
  that happens to be drawn in SVG, not a surface that should follow the palette.

  `shape-rendering="crispEdges"` turns off anti-aliasing. Half-lit module edges
  are exactly the noise a decoder has to threshold away.
-->
<svg
  class={cn('h-auto w-full rounded-md', className)}
  viewBox="{-QUIET} {-QUIET} {qr.size + QUIET * 2} {qr.size + QUIET * 2}"
  xmlns="http://www.w3.org/2000/svg"
  shape-rendering="crispEdges"
  role="img"
  aria-label={label}
>
  <title>{label}</title>
  <!-- The background has to be painted, and has to cover the quiet zone too. -->
  <rect
    x={-QUIET}
    y={-QUIET}
    width={qr.size + QUIET * 2}
    height={qr.size + QUIET * 2}
    fill="#ffffff"
  />
  <path d={qr.path} fill="#111111" />
</svg>
