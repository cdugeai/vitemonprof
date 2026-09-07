<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';

  let selectedClass = $state<string | undefined>('none');

  const classOptions = [
    { value: 'cp', label: 'CP' },
    { value: 'ce1', label: 'CE1' },
    { value: 'ce2', label: 'CE2' },
    { value: 'cm1', label: 'CM1' },
    { value: 'cm2', label: 'CM2' },
    { value: '6e', label: '6e' },
    { value: '5e', label: '5e' },
    { value: '4e', label: '4e' },
    { value: '3e', label: '3e' },
    { value: '2nde', label: '2nde' },
    { value: '1ere', label: '1ère' },
    { value: 'term', label: 'Terminale' },
  ];

  let optionDisabled = false;

  let selectedClassLabel = $derived(classOptions.find((c) => c.value == selectedClass));

  const triggerContent = $derived(
    classOptions.find((f) => f.value === selectedClass)?.label ?? 'Select a class'
  );
</script>

<Select.Root type="single" name="selected_class" bind:value={selectedClass}>
  <Select.Trigger class="w-45">
    {triggerContent}
  </Select.Trigger>
  <Select.Content>
    <Select.Group>
      <Select.Label>Classes</Select.Label>
      {#each classOptions as class_ (class_.value)}
        <Select.Item value={class_.value} label={class_.label} disabled={optionDisabled}>
          {class_.label}
        </Select.Item>
      {/each}
    </Select.Group>
  </Select.Content>
</Select.Root>
