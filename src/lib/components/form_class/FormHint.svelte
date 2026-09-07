<script lang="ts">
  import type { School } from '$lib/types/school';
  import * as Alert from '$lib/components/ui/alert';
  import InfoIcon from '@lucide/svelte/icons/info';
  import { firstMissingRequirement } from '$lib/utils_form';

  export interface FormHintProps {
    selectedSchool: School | undefined;
    selectedClass: string | undefined;
    selectedDate: string;
  }

  let { selectedSchool, selectedClass, selectedDate }: FormHintProps = $props();

  // $derived re-runs whenever any of the three props change, so the hint always
  // reflects the current draft without any manual syncing.
  let hint: string | null = $derived(
    firstMissingRequirement({ selectedSchool, selectedClass, selectedDate })
  );
</script>

{#if hint}
  <Alert.Root>
    <InfoIcon />
    <Alert.Title>Presque terminé</Alert.Title>
    <Alert.Description>{hint}</Alert.Description>
  </Alert.Root>
  <div class="mt-2"></div>
{/if}
