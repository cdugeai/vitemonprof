<script lang="ts">
  import type { School } from '$lib/types/school';

  let {
    school,
  }: {
    school: School | null;
  } = $props();
</script>

<div class="flex flex-col">
  {#if school == null}
    <p>No school selected</p>
  {:else}
    <p>{school.name}</p>
    <div class="flex flex-wrap gap-x-3 gap-y-0">
      <p>{school.city} ({school.postalCode})</p>
      <p class="font-light text-gray-500">{school.address}</p>
    </div>
  {/if}
</div>
