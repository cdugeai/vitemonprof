<script lang="ts">
  import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
  import { getLocalTimeZone, today, type CalendarDate } from '@internationalized/date';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import Calendar from '$lib/components/ui/calendar/calendar.svelte';

  import { Button } from '$lib/components/ui/button/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { dateToStr } from '$lib/utils';

  interface Props {
    date_: CalendarDate | undefined;
  }

  let { date_ = $bindable(undefined) }: Props = $props();

  const id = $props.id();

  let open = $state(false);
</script>

<div class="flex flex-col">
  <Label for="{id}-date" class="mb-1 px-1">Date</Label>
  <Popover.Root bind:open>
    <Popover.Trigger id="{id}-date">
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          class="bg-mybeige-bg w-full justify-between font-normal"
        >
          {date_ ? dateToStr(date_) : 'Date du cours'}
          <CalendarPlus />
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-auto overflow-hidden p-0" align="start">
      <Calendar
        type="single"
        bind:value={date_}
        captionLayout="dropdown"
        onValueChange={() => {
          open = false;
        }}
        maxValue={today(getLocalTimeZone())}
      />
    </Popover.Content>
  </Popover.Root>
</div>
