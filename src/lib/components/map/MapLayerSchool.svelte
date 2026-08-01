<script lang="ts">
  import 'svelte-maplibre-gl/vite'; // Required only for GL JS v6+
  import {
    CircleLayer,
    GeoJSONSource,
    Popup,
    SymbolLayer,
    getMapContext,
  } from 'svelte-maplibre-gl';
  import type { School } from '$lib/types/school';
  import type * as maplibregl from 'maplibre-gl';
  import type { FeatureCollection, Point } from 'geojson';
  import { MAP_CLUSTER_MAX_ZOOM, MAP_CLUSTER_RADIUS } from '$lib/constants';

  const MAP_SCHOOL_SOURCE_ID = 'schools';
  const MAP_SCHOOL_CLUSTERS_LAYER_ID = 'school-clusters';
  const MAP_SCHOOL_CLUSTER_COUNT_LAYER_ID = 'school-cluster-count';
  const MAP_SCHOOL_POINTS_LAYER_ID = 'school-points';

  interface Props {
    schools: School[];
    /** The school whose popup is currently open, or `null` when none is. */
    selectedSchool: School | null;
  }

  let {
    schools,
    // eslint-disable-next-line no-useless-assignment
    selectedSchool = $bindable(),
  }: Props = $props();

  const byId = $derived(new Map(schools.map((school) => [school.id, school])));

  // Update selectedSchoolId on selectedSchool update
  $effect(() => {
    selectedSchoolId = selectedSchool ? selectedSchool.id : null;
  });

  const mapCtx = getMapContext();
  $inspect(selectedSchool);
  /** The clustered source instance — needed for `getClusterExpansionZoom()`. */
  let source = $state.raw<maplibregl.GeoJSONSource | undefined>(undefined);

  /**
   * Clustering is done by MapLibre on a GeoJSON source, so the schools have to
   * be handed over as a FeatureCollection rather than as individual markers.
   */
  const data: FeatureCollection<Point, { id: string }> = $derived({
    type: 'FeatureCollection',
    features: schools.map((school) => ({
      type: 'Feature',
      // Only carry what the click handler needs; the full School is looked up
      // from `byId` so the popup renders typed data, not loose properties.
      properties: { id: school.id },
      geometry: { type: 'Point', coordinates: [school.longitude, school.latitude] },
    })),
  });

  function setCursor(cursor: string) {
    if (mapCtx.map) mapCtx.map.getCanvas().style.cursor = cursor;
  }

  /** Zoom to the level at which the clicked cluster splits into its children. */
  async function onClusterClick(ev: maplibregl.MapLayerMouseEvent) {
    const feature = ev.features?.[0];
    if (!feature || !source || !mapCtx.map) return;

    const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
    mapCtx.map.easeTo({
      center: (feature.geometry as Point).coordinates as [number, number],
      zoom,
    });
  }

  function onSchoolClick(ev: maplibregl.MapLayerMouseEvent) {
    const id = ev.features?.[0]?.properties.id as string | undefined;
    selectedSchool = (id && byId.get(id)) || null;
  }

  // The popup is deliberately created with `closeOnClick: false`: MapLibre would
  // register that listener *after* the layer handlers, so a click on a second
  // school would close the popup right after `onSchoolClick` reopened it.
  // Instead, dismiss it here — only when the click missed both school layers.
  $effect(() => {
    const map = mapCtx.map;
    if (!map) return;

    const onMapClick = (ev: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(ev.point, {
        layers: [MAP_SCHOOL_CLUSTERS_LAYER_ID, MAP_SCHOOL_POINTS_LAYER_ID],
      });
      if (hits.length === 0) selectedSchool = null;
    };

    map.on('click', onMapClick);
    return () => map.off('click', onMapClick);
  });
</script>

<GeoJSONSource
  id={MAP_SCHOOL_SOURCE_ID}
  bind:source
  {data}
  cluster
  clusterMaxZoom={MAP_CLUSTER_MAX_ZOOM}
  clusterRadius={MAP_CLUSTER_RADIUS}
>
  <!-- Clusters: bubble size and colour scale with the number of schools inside. -->
  <CircleLayer
    id={MAP_SCHOOL_CLUSTERS_LAYER_ID}
    filter={['has', 'point_count']}
    paint={{
      'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 50, '#f1f075', 150, '#f28cb1'],
      'circle-radius': ['+', 12, ['sqrt', ['get', 'point_count']]],
      'circle-opacity': 0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    }}
    onclick={onClusterClick}
    onmouseenter={() => setCursor('pointer')}
    onmouseleave={() => setCursor('')}
  />

  <SymbolLayer
    id={MAP_SCHOOL_CLUSTER_COUNT_LAYER_ID}
    filter={['has', 'point_count']}
    layout={{ 'text-field': '{point_count_abbreviated}', 'text-size': 12 }}
    paint={{ 'text-color': '#1f2937' }}
  />

  <!-- Individual schools, once zoomed past `clusterMaxZoom`. -->
  <CircleLayer
    id={MAP_SCHOOL_POINTS_LAYER_ID}
    filter={['!', ['has', 'point_count']]}
    paint={{
      'circle-color': '#e11d48',
      'circle-radius': 6,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    }}
    onclick={onSchoolClick}
    onmouseenter={() => setCursor('pointer')}
    onmouseleave={() => setCursor('')}
  />
</GeoJSONSource>

{#if selectedSchool}
  {@const school = selectedSchool}
  <Popup
    class="text-black"
    lnglat={{ lng: school.longitude, lat: school.latitude }}
    offset={12}
    closeOnClick={false}
    onclose={() => (selectedSchool = null)}
  >
    <span class="text-sm">{school.name}</span>
  </Popup>
{/if}
