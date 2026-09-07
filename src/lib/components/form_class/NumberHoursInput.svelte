<script lang="ts">
  import * as ToggleGroup from '$lib/components/ui/toggle-group';

  const HOUR_OPTIONS = [1, 2, 3, 4];
  const DEFAULT_NB_HOURS = HOUR_OPTIONS[0];

  interface Props {
    nbHours?: number;
  }

  let { nbHours = $bindable(DEFAULT_NB_HOURS) }: Props = $props();
</script>

<span id="nb-hours-label" class="px-1 text-sm leading-none font-medium select-none">
  Nombre d'heures de classe
</span>
<ToggleGroup.Root
  type="single"
  variant="outline"
  size="lg"
  aria-labelledby="nb-hours-label"
  class="w-full"
  // So wont de-select value when clicking a second time on it
  bind:value={() => String(nbHours), (value) => (nbHours = Number(value) || nbHours)}
>
  {#each HOUR_OPTIONS as hours (hours)}
    <ToggleGroup.Item
      value={String(hours)}
      aria-label={`${hours} heure${hours > 1 ? 's' : ''}`}
      class="bg-mybeige-bg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 flex-1 text-base tabular-nums"
    >
      {hours}
    </ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>
