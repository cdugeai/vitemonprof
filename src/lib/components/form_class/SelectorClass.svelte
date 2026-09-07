<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import { Label } from '$lib/components/ui/label';
  import {
    CLASS_CYCLE_LABELS,
    classLevelLabel,
    classLevelsInCycle,
    cyclesForSchoolName,
    type ClassLevel,
  } from '$lib/classLevels';

  interface Props {
    selectedClass?: ClassLevel;
    /**
     * The selected school's name, or `undefined` while none is picked — the only
     * thing this component needs from `School`, so it asks for exactly that
     * rather than for the whole record.
     */
    schoolName?: string;
  }

  let { selectedClass = $bindable(), schoolName }: Props = $props();

  const triggerContent = $derived(
    selectedClass ? classLevelLabel(selectedClass) : 'Sélectionner une classe'
  );

  // A collège has no CM2 and no Terminale, so offering them is noise. The guess
  // is deliberately generous — an unrecognised name yields every cycle — which is
  // why this can narrow the list without ever hiding the class someone came to
  // report.
  const visibleCycles = $derived(cyclesForSchoolName(schoolName));

  const visibleLevelIds = $derived(
    new Set(visibleCycles.flatMap((cycle) => classLevelsInCycle(cycle).map((l) => l.id)))
  );

  /**
   * Drop a selection the new school can't have.
   *
   * Picking « 3e » and *then* the lycée down the road would otherwise leave the
   * trigger reading « 3e » with no such option in the list — and, worse, post that
   * value. Clearing it puts the form back in its "choose a class" state, which
   * `FormHint` and the submit button already handle.
   *
   * An `$effect` rather than a `$derived`, because the value is owned by the
   * parent and only *occasionally* forced: `selectedClass` has to stay a plain
   * bindable the user drives. The write re-runs this effect once, finds the value
   * valid (or absent), and stops — no loop.
   */
  $effect(() => {
    if (selectedClass && !visibleLevelIds.has(selectedClass)) selectedClass = undefined;
  });
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
    {#each visibleCycles as cycle (cycle)}
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
