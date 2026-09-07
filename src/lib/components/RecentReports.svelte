<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import type { MissedHour } from '$lib/types/missedHours';

  interface Props {
    missed_hours: MissedHour[];
    is_loading: boolean;
  }

  let { missed_hours, is_loading }: Props = $props();
  const LAST_TO_DISPLAY = 5;
  let missed_hours_to_display = $derived(missed_hours.slice(0, LAST_TO_DISPLAY));
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
        {/each}
      {/if}
    </div>
  </Card.Content>
</Card.Root>
