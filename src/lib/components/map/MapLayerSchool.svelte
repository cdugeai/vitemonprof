<script lang="ts">
  import 'svelte-maplibre-gl/vite'; // Required only for GL JS v6+
  import { GeoJSONSource, CircleLayer } from 'svelte-maplibre-gl';
  import type { School } from '$lib/types/school';

  interface Props {
    schools: School[];
  }

  const { schools }: Props = $props();
  let geoJsonData = $derived({
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
  });
</script>

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
