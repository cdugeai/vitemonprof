<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import { Label } from '$lib/components/ui/label';
  import {
    DISCIPLINE_GROUPS,
    DISCIPLINE_GROUP_LABELS,
    disciplineLabel,
    disciplinesInGroup,
    type Discipline,
  } from '$lib/disciplines';

  interface Props {
    selectedDiscipline?: Discipline;
  }

  let { selectedDiscipline = $bindable() }: Props = $props();

  const triggerContent = $derived(
    selectedDiscipline ? disciplineLabel(selectedDiscipline) : 'Sélectionner une discipline'
  );
</script>

<!--
  A `<Select>` here, not the segmented control used for the group: 23 options with
  labels as long as « Histoire-géographie, géopolitique et sciences politiques »
  have no chance of fitting on screen at once. That is the line between the two
  patterns in this form — ToggleGroup while every option is visible, Select once
  scrolling is unavoidable.

  `Select.Group` mirrors the curriculum's own split between the common core and the
  thirteen specialities. That is worth the markup: it turns one 23-item wall into
  two short, scannable lists, and bits-ui exposes it as a labelled group so screen
  readers announce the section too.
-->
<Select.Root type="single" bind:value={selectedDiscipline}>
  <Label for="sel-discipline" class="px-1">
    Discipline <span class="text-muted-foreground font-normal">(optionnel)</span>
  </Label>
  <Select.Trigger class="bg-mybeige-bg w-full" id="sel-discipline">
    <span class="truncate">{triggerContent}</span>
  </Select.Trigger>
  <Select.Content>
    {#each DISCIPLINE_GROUPS as group (group)}
      <Select.Group>
        <Select.Label>{DISCIPLINE_GROUP_LABELS[group]}</Select.Label>
        {#each disciplinesInGroup(group) as discipline (discipline.id)}
          <!--
            `label` (not just the slot content) is what bits-ui reads back for the
            typeahead and the selected-value text, so it has to be the plain label —
            the note below is decoration and must stay out of it.
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
    {/each}
  </Select.Content>
</Select.Root>
