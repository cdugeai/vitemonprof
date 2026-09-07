<script lang="ts">
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { CLASS_GROUPS, classGroupLabel, type ClassGroup } from '$lib/classGroups';

  interface Props {
    selectedClassGroup?: ClassGroup;
  }

  let { selectedClassGroup = $bindable() }: Props = $props();
</script>

<span id="class-group-label" class="px-1 text-sm leading-none font-medium select-none">
  Groupe <span class="text-muted-foreground font-normal">(optionnel)</span>
</span>
<p id="class-group-hint" class="text-muted-foreground -mt-1 px-1 text-xs">
  La lettre ou le numéro après le niveau, par ex. « 6e A » ou « 6e 3 ».
</p>

<!--
  A segmented control rather than a `<Select>`: seven single-character options all
  fit on one row, so the whole choice is visible and one tap away. A dropdown would
  add an open/scan/close cycle to pick between "A" and "B".

  bits-ui renders `type="single"` items as `role="radio"` with `aria-checked`, so
  this is a radio group wearing a segmented control's clothes — the right semantics
  without seven stacked radio dots.

  Unlike `NumberHoursInput`, deselection is *allowed* here: the field is optional
  (plenty of schools have one class per level), so clicking the active button again
  has to be able to clear it. bits-ui uses `''` for "nothing selected" in single
  mode; the getter/setter bind translates that to `undefined` so the rest of the app
  only ever sees a real group or nothing at all.
-->
<ToggleGroup.Root
  type="single"
  variant="outline"
  size="lg"
  aria-labelledby="class-group-label"
  aria-describedby="class-group-hint"
  class="w-full"
  bind:value={
    () => selectedClassGroup ?? '',
    (value) => (selectedClassGroup = value === '' ? undefined : (value as ClassGroup))
  }
>
  {#each CLASS_GROUPS as group, index (group)}
    <ToggleGroup.Item
      value={group}
      aria-label={`Groupe ${group}, ou ${index + 1}`}
      class="bg-mybeige-bg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 min-w-0 flex-1 px-0 text-sm tabular-nums"
    >
      {classGroupLabel(group)}
    </ToggleGroup.Item>
  {/each}
</ToggleGroup.Root>
