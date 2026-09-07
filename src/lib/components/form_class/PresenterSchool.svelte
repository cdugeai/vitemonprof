<script lang="ts">
  import type { School } from '$lib/types/school';

  let {
    school,
    force_newline = false,
  }: {
    school: School | undefined;
    force_newline?: boolean;
  } = $props();
</script>

<div class="flex flex-col">
  {#if school == undefined}
    <p>Aucune école sélectionnée</p>
  {:else}
    <p>{school.name}</p>
    <div class="flex flex-wrap gap-x-3 gap-y-0">
      <p>{school.city} ({school.postalCode})</p>
      {#if force_newline}
        <br />
      {/if}
      <p class="font-light text-gray-500">{school.address}</p>
    </div>
  {/if}
</div>
