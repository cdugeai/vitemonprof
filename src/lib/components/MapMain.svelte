<script lang="ts">
  import 'svelte-maplibre-gl/vite'; // Required only for GL JS v6+
  import { MapLibre, NavigationControl, ScaleControl, GlobeControl } from 'svelte-maplibre-gl';
  import { onMount } from 'svelte';
  import type { School } from '$lib/types/school';
  import { cachedSchools, loadSchools } from '$lib/schools-cache';
  import MapLayerSchool from './map/MapLayerSchool.svelte';
  import { MAP_DEFAULT_LAT, MAP_DEFAULT_LNG, MAP_DEFAULT_ZOOM } from '$lib/constants';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  interface Props {
    selectedSchool: School | undefined;
  }

  let { selectedSchool = $bindable(undefined) }: Props = $props();

  // Seeded from the cache rather than from `[]`, so a second visit to the tab —
  // or a visit after `CardReport` preloaded on hover — renders the schools on the
  // first frame instead of flashing "Chargement…" for one paint.
  let schools = $state<School[]>(cachedSchools() ?? []);
  let status = $state<'loading' | 'ready' | 'error'>(cachedSchools() ? 'ready' : 'loading');

  async function load() {
    status = 'loading';

    try {
      schools = await loadSchools();
      status = 'ready';
    } catch (error) {
      console.error('Failed to load schools:', error);
      status = 'error';
    }
  }

  onMount(() => {
    if (status !== 'ready') load();
  });
</script>

<!--
  The basemap renders immediately and stays interactive while the ~2.5 MB
  registry downloads, so the wait costs panning and zooming nothing.

  That is also why this is an overlay rather than a spinner *instead of* the map:
  before it existed, the map appeared complete but empty for several seconds, and
  a finished-looking map with no schools on it reads as "there are no schools"
  rather than as "still loading" — a worse failure than an honest wait.
-->
<div class="relative h-full w-full">
  <MapLibre
    class="h-full w-full"
    style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
    zoom={MAP_DEFAULT_ZOOM}
    center={{ lng: MAP_DEFAULT_LNG, lat: MAP_DEFAULT_LAT }}
  >
    <MapLayerSchool {schools} bind:selectedSchool />

    <NavigationControl />
    <ScaleControl />
    <GlobeControl />
  </MapLibre>

  {#if status !== 'ready'}
    <!--
      `pointer-events-none` on the wrapper so the notice never intercepts a drag
      on the map underneath it; the retry button opts back in, since it is the
      one thing here meant to be clicked.
    -->
    <div class="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2">
      {#if status === 'loading'}
        <!--
          `role="status"` announces this politely once, without stealing focus.
          `aria-live` is implicit in the role, so a screen reader hears
          "Chargement des établissements…" when it appears and the result when it
          goes.
        -->
        <p
          role="status"
          class="bg-background/95 text-muted-foreground flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur"
        >
          <LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
          Chargement des établissements…
        </p>
      {:else}
        <p
          role="alert"
          class="bg-background/95 pointer-events-auto flex items-center gap-2 rounded-full border border-red-600/30 px-3 py-1.5 text-xs text-red-900 shadow-sm backdrop-blur dark:text-red-200"
        >
          <TriangleAlert class="size-3.5" aria-hidden="true" />
          Les établissements n'ont pas pu être chargés.
          <button type="button" class="font-semibold underline underline-offset-2" onclick={load}>
            Réessayer
          </button>
        </p>
      {/if}
    </div>
  {/if}
</div>
