<script lang="ts">
  import 'svelte-maplibre-gl/vite'; // Required only for GL JS v6+
  import { MapLibre, NavigationControl, ScaleControl, GlobeControl } from 'svelte-maplibre-gl';
  import { onMount } from 'svelte';
  import type { School } from '$lib/types/school';
  import MapLayerSchool from './map/MapLayerSchool.svelte';
  import { MAP_DEFAULT_LAT, MAP_DEFAULT_LNG, MAP_DEFAULT_ZOOM } from '$lib/constants';

  let schools = $state<School[]>([]);

  onMount(async () => {
    try {
      const response = await fetch('/api/schools');
      schools = await response.json();
    } catch (error) {
      console.error('Failed to load schools:', error);
    }
  });
</script>

<MapLibre
  class="h-full w-full"
  style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
  zoom={MAP_DEFAULT_ZOOM}
  center={{ lng: MAP_DEFAULT_LNG, lat: MAP_DEFAULT_LAT }}
>
  <MapLayerSchool {schools} />

  <NavigationControl />
  <ScaleControl />
  <GlobeControl />
</MapLibre>
