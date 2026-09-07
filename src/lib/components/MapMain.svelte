<script lang="ts">
  import 'svelte-maplibre-gl/vite'; // Required only for GL JS v6+
  import { MapLibre, NavigationControl, ScaleControl, GlobeControl, GeoJSONSource, CircleLayer } from 'svelte-maplibre-gl';
  import { onMount } from 'svelte';
  import type { School } from '$lib/types/school';

  let schools = $state<School[]>([]);
  let geoJsonData = $state({
    type: 'FeatureCollection' as const,
    features: [] as any[],
  });

  onMount(async () => {
    try {
      const response = await fetch('/api/schools');
      schools = await response.json();

      geoJsonData = {
        type: 'FeatureCollection',
        features: schools.map((school) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [school.longitude, school.latitude],
          },
          properties: {
            id: school.id,
            name: school.name,
            address: school.address,
            city: school.city,
            postalCode: school.postalCode,
          },
        })),
      };
    } catch (error) {
      console.error('Failed to load schools:', error);
    }
  });
</script>

<MapLibre
  class="h-full w-full"
  style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
  zoom={4}
  center={{ lng: 2.3, lat: 46.2 }}
>
  {#if geoJsonData.features.length > 0}
    <GeoJSONSource id="schools" data={geoJsonData} />
    <CircleLayer
      id="schools-layer"
      source="schools"
      paint={{
        'circle-radius': 8,
        'circle-color': '#3b82f6',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.8,
      }}
    />
  {/if}
  <NavigationControl />
  <ScaleControl />
  <GlobeControl />
</MapLibre>
