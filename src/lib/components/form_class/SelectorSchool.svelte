<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import type { School } from '$lib/types/school';
  import Input from '../ui/input/input.svelte';
  import { Label } from '$lib/components/ui/label';
  import { buildLabelSchool } from '$lib/utils';
  import { createSelectSearchFocus } from './searchableSelect';

  let {
    // eslint-disable-next-line no-useless-assignment
    selectedSchool = $bindable(),
  }: {
    selectedSchool: School | undefined;
  } = $props();

  /** Idle time after the last keystroke before we hit the API. */
  const DEBOUNCE_MS = 250;
  /** Shorter than this and the query matches almost everything — not worth a round trip. */
  const MIN_QUERY_LENGTH = 2;

  let open = $state(false);
  let typedText = $state('');
  let schools: School[] = $state([]);
  let isLoading = $state(false);

  const schoolOptions = $derived(
    schools.map((s) => ({
      value: s.id,
      label: buildLabelSchool(s),
    }))
  );

  let selectedLabel = $derived(selectedSchool ? buildLabelSchool(selectedSchool) : '');
  // The trigger label can't be looked up in `schoolOptions`: the list is whatever the
  // last search returned, and the user typing a new query would blank out their own
  // selection. So capture the label at pick time and keep it.

  const triggerContent = $derived(selectedLabel || 'Sélectionnez un établissement');

  async function fetchSchools(query: string, signal: AbortSignal): Promise<School[]> {
    const params = new URLSearchParams({ query_string: query });
    const res = await fetch(`/api/schools?${params}`, { signal });

    if (!res.ok) {
      throw new Error(`GET /api/schools failed: ${res.status}`);
    }

    return res.json();
  }

  // `$effect` re-runs whenever `typedText` changes. Its cleanup both cancels the pending
  // debounce timer and aborts the in-flight request, which is what keeps a slow earlier
  // response from landing on top of a newer one.
  // Effects never run during SSR, so the relative URL is always browser-side here.
  $effect(() => {
    const query = typedText.trim();

    if (query.length < MIN_QUERY_LENGTH) {
      schools = [];
      isLoading = false;
      return;
    }

    const controller = new AbortController();
    isLoading = true;

    const timer = setTimeout(() => {
      fetchSchools(query, controller.signal)
        .then((r) => (schools = r))
        .catch((err) => {
          if (err.name !== 'AbortError') console.error(err);
        })
        .finally(() => {
          if (!controller.signal.aborted) isLoading = false;
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  function onOpenChange(isOpen: boolean) {
    // Start each visit to the dropdown from a clean search.
    if (!isOpen) typedText = '';
  }

  const search = createSelectSearchFocus(() => open);

  function onValueChange(value: string) {
    // Update School when Id is updated
    selectedSchool = schools.find((sc) => sc.id == value);
  }
</script>

<Select.Root type="single" name="selected_school" bind:open {onOpenChange} {onValueChange}>
  <Label for="sel-school" class="px-1 text-sm font-semibold">Établissement</Label>
  <Select.Trigger
    class="bg-mybeige-bg w-full overflow-hidden"
    onfocus={search.onTriggerFocus}
    id="sel-school"
  >
    <span class="overflow-hidden">
      {triggerContent}
    </span>
  </Select.Trigger>
  <Select.Content class="max-h-65 ">
    <Select.Group>
      <Select.Label>Établissement</Select.Label>
      <Input bind:value={typedText} class="my-1" placeholder="Rechercher" {@attach search.field} />
      {#each schoolOptions as school_ (school_.value)}
        <Select.Item value={school_.value} label={school_.label}>
          {school_.label}
        </Select.Item>
      {:else}
        <p class="text-muted-foreground px-2 py-3 text-sm">
          {#if isLoading}
            Recherche…
          {:else if typedText.trim().length < MIN_QUERY_LENGTH}
            Tapez au moins {MIN_QUERY_LENGTH} caractères
          {:else}
            Aucun établissement trouvé
          {/if}
        </p>
      {/each}
    </Select.Group>
  </Select.Content>
</Select.Root>
