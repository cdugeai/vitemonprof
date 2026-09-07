<script lang="ts">
  import 'svelte-maplibre-gl/vite'; // Required only for GL JS v6+
  import { Marker, Popup } from 'svelte-maplibre-gl';
  import type { School } from '$lib/types/school';
  import type * as maplibregl from 'maplibre-gl';

  interface Props {
    schools: School[];
  }

  const { schools }: Props = $props();

  let offset = $state(24);

  let offsets: maplibregl.Offset = $derived({
    top: [0, offset],
    bottom: [0, -offset],
    left: [offset + 12, 0],
    right: [-offset - 12, 0],
    center: [0, 0],
    'top-left': [offset, offset],
    'top-right': [-offset, offset],
    'bottom-left': [offset, -offset],
    'bottom-right': [-offset, -offset],
  });
  let selected_school: string = $state('');
</script>

{#each schools as school (school.id)}
  {@const lnglat = { lng: school.longitude, lat: school.latitude }}
  {@const is_selected = school.id == selected_school}
  <Marker {lnglat} onclick={() => selected_school == school.id}>
    {#snippet content()}
      <div class="text-center leading-none">
        <div class="text-3xl">📍</div>
        <!-- Text under icon -->
        <!-- <div class="font-bold text-black drop-shadow-xs">{school.name}</div> -->
      </div>
    {/snippet}
    <Popup class="text-black" open={is_selected} offset={offsets}>
      <span class="text-sm">{school.name}</span>
    </Popup>
  </Marker>
{/each}
