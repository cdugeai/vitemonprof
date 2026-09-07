<script lang="ts">
  import type { School } from '$lib/types/school';
  import { cn } from '$lib/utils';

  let {
    school,
    class: className,
  }: {
    school: School;
    /** Merged onto the wrapper, so callers own the spacing/width context. */
    class?: string;
  } = $props();
</script>

<!--
  A school's identity, always stacked: name, then street, then postcode + city —
  the order a French postal address is written in, which is what makes it
  skimmable without any labels.

  The secondary lines are muted with `opacity`, not with `text-muted-foreground`.
  This block renders both inside a themed form field *and* inside a MapLibre
  popup, whose background is white in both light and dark mode. A theme token
  would be near-white on that white popup; inheriting the ambient colour at 70 %
  is legible against whatever background it lands on.
-->
<div class={cn('flex min-w-0 flex-col gap-0.5 leading-snug', className)}>
  <p class="font-medium break-words">{school.name}</p>
  <p class="text-sm break-words opacity-70">{school.address}</p>
  <p class="text-sm break-words opacity-70">{school.postalCode} {school.city}</p>
</div>
