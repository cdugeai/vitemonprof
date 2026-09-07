<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import { Label } from '$lib/components/ui/label';
  import {
    CLASS_CYCLES,
    CLASS_CYCLE_LABELS,
    classLevelLabel,
    classLevelsInCycle,
    type ClassLevel,
  } from '$lib/classLevels';

  interface Props {
    selectedClass?: ClassLevel;
  }

  let { selectedClass = $bindable() }: Props = $props();

  const triggerContent = $derived(
    selectedClass ? classLevelLabel(selectedClass) : 'Sélectionner une classe'
  );
</script>

<!--
  The options come from `$lib/classLevels` rather than a list inlined here, so the
  same mapping that renders this dropdown is what turns `1ere` back into « 1ère »
  in the reports list — previously the label existed only inside this component,
  which is why the list showed raw ids.

  Grouped by cycle for the same reason `SelectorDiscipline` is: twelve options in
  three familiar blocks scan far better than one flat twelve. No search box here —
  twelve short labels do not need one.
-->
<Select.Root type="single" name="selected_class" bind:value={selectedClass}>
  <Label for="sel-class" class="px-1">Classe</Label>
  <Select.Trigger class="bg-mybeige-bg w-full" id="sel-class">
    {triggerContent}
  </Select.Trigger>
  <Select.Content>
    {#each CLASS_CYCLES as cycle (cycle)}
      <Select.Group>
        <Select.Label>{CLASS_CYCLE_LABELS[cycle]}</Select.Label>
        {#each classLevelsInCycle(cycle) as level (level.id)}
          <Select.Item value={level.id} label={level.label}>
            {level.label}
          </Select.Item>
        {/each}
      </Select.Group>
    {/each}
  </Select.Content>
</Select.Root>
