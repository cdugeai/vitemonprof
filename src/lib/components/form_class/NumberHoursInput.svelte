<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import Button from '../ui/button/button.svelte';
  const DEFAULT_NB_HOURS = 1;
  const MAX_NB_HOURS = 4;
  const MIN_NB_HOURS = 1;

  interface Props {
    nbHours?: number;
  }

  let { nbHours = $bindable(DEFAULT_NB_HOURS) }: Props = $props();
  let inc = () => (nbHours = Math.min(nbHours + 1, MAX_NB_HOURS));
  let dec = () => (nbHours = Math.max(nbHours - 1, MIN_NB_HOURS));
</script>

<Label for="nb_hours">Nombre d'heures de classe</Label>
<div class="flex gap-1">
  <Button variant="outline" class="px-15" onclick={dec}>-</Button>
  <Button variant="default" class="px-15" onclick={inc}>+</Button>
  <Input
    id="nb_hours"
    type="number"
    name="nbHours"
    max={MAX_NB_HOURS}
    min={MIN_NB_HOURS}
    step="1"
    bind:value={nbHours}
    required
    class="bg-mybeige-bg md:max-w-1/2"
    disabled
  />
</div>
