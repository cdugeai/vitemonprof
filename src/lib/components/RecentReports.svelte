<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { getSchoolsInfo } from '$lib/server/db_tmp';
  import type { MissedHour } from '$lib/types/missedHours';
  import type { School } from '$lib/types/school';
  import { onMount } from 'svelte';

  interface Props {
    missed_hours: MissedHour[];
    is_loading: boolean;
  }

  let { missed_hours, is_loading }: Props = $props();
  const LAST_TO_DISPLAY = 5;
  let missed_hours_to_display = $derived(missed_hours.slice(0, LAST_TO_DISPLAY));

  let schools_infos: Map<string, School> = $state(new Map());

  onMount(async () => {
    let r = await getSchoolsInfo(missed_hours_to_display.map((mh1) => mh1.schoolId));
    schools_infos = r;
  });
</script>

<!-- Recent Reports -->
<Card.Root>
  <Card.Header>
    <Card.Title>Recent Reports</Card.Title>
  </Card.Header>
  <Card.Content>
    <div class="space-y-3">
      {#if is_loading}
        <div class="py-8 text-center text-gray-500">Loading recent reports...</div>
      {:else if missed_hours.length < 1}
        <div class="py-8 text-center text-gray-500">No reports yet</div>
      {:else}
        {#each missed_hours_to_display as mh (mh.uuid)}
          <p>{mh.schoolId}</p>
          <p>{schools_infos.get(mh.schoolId)?.name}</p>
        {/each}
      {/if}
    </div>
  </Card.Content>
</Card.Root>
