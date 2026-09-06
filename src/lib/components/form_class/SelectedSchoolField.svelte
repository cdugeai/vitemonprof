<script lang="ts">
  import MapPin from '@lucide/svelte/icons/map-pin';
  import X from '@lucide/svelte/icons/x';
  import type { School } from '$lib/types/school';
  import PresenterSchool from './PresenterSchool.svelte';

  let {
    selectedSchool = $bindable(),
  }: {
    selectedSchool: School | undefined;
  } = $props();
</script>

<!--
  The « Carte » tab's read-out of what the user picked on the map.

  It deliberately mirrors `SelectorSchool`'s field — same heading text, same
  `bg-mybeige-bg` box, same border and radius — so switching tabs doesn't feel
  like switching forms. What it is *not* is a disabled `<Select>`: a greyed-out
  dropdown reads as "this control is broken / you lack permission", which is the
  opposite of the truth here (the map *is* the control). A plain read-out with
  an explicit instruction says the same thing without the false signal.

  The heading is a `<span>`, not a `<Label>`: a `<label>` that labels no form
  control is a lie to a screen reader. The box carries the accessible name
  instead, via `aria-label`, and `aria-live="polite"` so that clicking a marker —
  a change that happens far from the keyboard focus — is announced rather than
  silently applied.
-->
<div class="mt-3 flex flex-col gap-1">
  <span class="px-1 text-sm font-semibold">Établissement</span>

  <div
    class="bg-mybeige-bg flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
    aria-label="Établissement sélectionné"
    aria-live="polite"
  >
    {#if selectedSchool}
      <MapPin class="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <PresenterSchool school={selectedSchool} class="flex-1" />
      <button
        type="button"
        class="text-muted-foreground hover:bg-mybeigestrong-bg hover:text-foreground focus-visible:ring-ring/50 -mt-1 -mr-1.5 shrink-0 rounded-md p-1.5 transition-colors outline-none focus-visible:ring-3"
        onclick={() => (selectedSchool = undefined)}
      >
        <X class="size-4" aria-hidden="true" />
        <span class="sr-only">Désélectionner l'établissement</span>
      </button>
    {:else}
      <MapPin class="mt-0.5 size-4 shrink-0 opacity-50" aria-hidden="true" />
      <p class="text-muted-foreground flex-1">
        Cliquez sur un établissement de la carte pour le sélectionner.
      </p>
    {/if}
  </div>
</div>
