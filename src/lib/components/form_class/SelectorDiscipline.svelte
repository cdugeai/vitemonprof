<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import { Label } from '$lib/components/ui/label';
  import Input from '../ui/input/input.svelte';
  import {
    DISCIPLINE_GROUPS,
    DISCIPLINE_GROUP_LABELS,
    disciplineLabel,
    searchDisciplines,
    type Discipline,
  } from '$lib/disciplines';
  import { createSelectSearchFocus } from './searchableSelect';

  interface Props {
    selectedDiscipline?: Discipline;
  }

  let { selectedDiscipline = $bindable() }: Props = $props();

  let open = $state(false);
  let typedText = $state('');

  /**
   * Filtering is a plain `$derived`, with none of the debounce/abort machinery
   * `SelectorSchool` needs. The difference is that the 23 disciplines are already
   * in memory: there is no round trip to throttle and no slow response that could
   * land on top of a newer one, so the list can simply be recomputed on every
   * keystroke. Debouncing a synchronous filter would only add latency.
   */
  const matches = $derived(searchDisciplines(typedText));

  /**
   * Grouped for display, with empty groups dropped — so searching "maths" shows
   * only « Enseignements de spécialité » rather than a stray heading with nothing
   * under it.
   */
  const groups = $derived(
    DISCIPLINE_GROUPS.map((group) => ({
      group,
      items: matches.filter((d) => d.group === group),
    })).filter(({ items }) => items.length > 0)
  );

  /**
   * Read from `selectedDiscipline` rather than from `matches`. The visible list is
   * whatever the current query returns, so looking the label up there would blank
   * out the user's own selection the moment they typed a new search — the same
   * trap `SelectorSchool` documents, avoided here because the full mapping is
   * always available to look up against.
   */
  const triggerContent = $derived(
    selectedDiscipline ? disciplineLabel(selectedDiscipline) : 'Sélectionner une discipline'
  );

  const search = createSelectSearchFocus(() => open);

  function onOpenChange(isOpen: boolean) {
    // Start each visit to the dropdown from a clean search.
    if (!isOpen) typedText = '';
  }
</script>

<Select.Root type="single" bind:value={selectedDiscipline} bind:open {onOpenChange}>
  <Label for="sel-discipline" class="px-1">
    Discipline <span class="text-muted-foreground font-normal">(optionnel)</span>
  </Label>
  <Select.Trigger
    class="bg-mybeige-bg w-full overflow-hidden"
    onfocus={search.onTriggerFocus}
    id="sel-discipline"
  >
    <span class="truncate">{triggerContent}</span>
  </Select.Trigger>
  <Select.Content class="max-h-72">
    <Input
      bind:value={typedText}
      class="my-1"
      placeholder="Rechercher une discipline"
      {@attach search.field}
    />
    <!--
      The groups mirror the curriculum's own split between the common core and the
      thirteen specialities, which turns one 23-item wall into two scannable lists.
      They survive filtering rather than collapsing into a flat result list, so the
      shape of the menu stays recognisable as you narrow it.
    -->
    {#each groups as { group, items } (group)}
      <Select.Group>
        <Select.Label>{DISCIPLINE_GROUP_LABELS[group]}</Select.Label>
        {#each items as discipline (discipline.id)}
          <!--
            `label` is what bits-ui reads back for its own value handling, so it has
            to stay the plain label — the note below is decoration and must not
            leak into it.
          -->
          <Select.Item value={discipline.id} label={discipline.label}>
            <span class="flex flex-col items-start">
              <span>{discipline.label}</span>
              {#if discipline.note}
                <span class="text-muted-foreground text-xs">{discipline.note}</span>
              {/if}
            </span>
          </Select.Item>
        {/each}
      </Select.Group>
    {:else}
      <p class="text-muted-foreground px-2 py-3 text-sm">Aucune discipline trouvée</p>
    {/each}
  </Select.Content>
</Select.Root>
