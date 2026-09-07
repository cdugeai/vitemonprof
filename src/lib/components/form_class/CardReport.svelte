<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  // Icons
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Send from '@lucide/svelte/icons/send';
  import List from '@lucide/svelte/icons/list';
  import MapPin from '@lucide/svelte/icons/map-pin';

  import { type CalendarDate } from '@internationalized/date';

  import * as Tabs from '$lib/components/ui/tabs/index.js';

  import SelectorClass from './SelectorClass.svelte';
  import SelectorDepartement from './SelectorDepartement.svelte';
  import SelectorSchool from './SelectorSchool.svelte';
  import DatePicker from '../DatePicker.svelte';
  import MapMain from '../MapMain.svelte';
  import PresenterSchool from './PresenterSchool.svelte';
  import type { School } from '$lib/types/school';
  import FormHint from './FormHint.svelte';
  import { dateToStr } from '$lib/utils';
  import NumberHoursInput from './NumberHoursInput.svelte';

  interface Props {
    selectedDept?: string;
    selectedClass?: string;
    selectedSchool?: School;
    selectedDate?: CalendarDate;
    nbHours?: number;
    canSubmit: boolean;
  }

  let {
    selectedDept = $bindable(),
    selectedClass = $bindable(),
    selectedSchool = $bindable(),
    selectedDate = $bindable(),
    nbHours = $bindable(),
    canSubmit = $bindable(),
  }: Props = $props();
</script>

<div class="space-y-4">
  <Card.Root class="mx-auto w-full lg:max-w-md">
    <Card.Header>
      <div class="flex flex-row items-start gap-3">
        <span class="bg-mybeigestrong-bg text-primary rounded-xl p-2.5"
          ><CalendarDays class="h-5 w-5" />
        </span>

        <div class="flex flex-col">
          <Card.Title>Signaler une classe manquée</Card.Title>
          <Card.Description>
            <p>
              Enregistrez quand un cours n'a pas pu se dérouler parce que le professeur était
              absent.
            </p>
          </Card.Description>
        </div>
      </div>
    </Card.Header>
    <Card.Content class=" -mb-(--card-spacing)">
      <Tabs.Root value="o_list" class="mb-4 sm:col-span-2 ">
        <Tabs.List class="bg-mybeigestrong-bg w-full">
          <Tabs.Trigger value="o_list">
            <List />
            Liste
          </Tabs.Trigger>
          <Tabs.Trigger value="o_map">
            <MapPin />
            Carte
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="o_list">
          <div class="flex flex-col gap-2">
            <SelectorDepartement bind:selectedDept />
            <SelectorSchool bind:selectedSchool />
          </div>
        </Tabs.Content>
        <Tabs.Content value="o_map">
          <div class="h-75 overflow-hidden rounded-xl border bg-gray-100">
            <MapMain bind:selectedSchool />
          </div>
          <PresenterSchool school={selectedSchool} />
        </Tabs.Content>
        <div class="flex flex-col gap-2">
          <SelectorClass bind:selectedClass />
          <DatePicker bind:date_={selectedDate} />
          <NumberHoursInput bind:nbHours />
        </div>
      </Tabs.Root>
      <FormHint {selectedSchool} {selectedClass} selectedDate={dateToStr(selectedDate)} />

      <Button type="submit" class="mb-3 w-full rounded-xl p-5" disabled={!canSubmit}>
        <Send />
        <span>Envoyer le rapport</span>
      </Button>
    </Card.Content>
  </Card.Root>
</div>
