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

  /**
   * MapLibre is ~1 MB of JavaScript — several times the weight of everything else on
   * this page combined. A static `import` would put it in the page's initial chunk, and
   * since the page can't hydrate until that chunk has downloaded, parsed and executed,
   * every control here would sit dead for seconds on a mid-range phone. So it is loaded
   * on demand instead, and only lands on the wire when someone asks for the map.
   *
   * The `{#if}` is load-bearing for a second reason: bits-ui's `Tabs.Content` does *not*
   * unmount inactive panels, it renders them with `hidden`. Without this guard `MapMain`
   * would mount on page load — booting a WebGL context and fetching basemap tiles into a
   * zero-size hidden box — even for visitors who never leave the "Liste" tab.
   *
   * `$state.raw` because the value is a Promise: we want reactivity when it is *replaced*,
   * not a deep proxy wrapped around it. `??=` keeps it to a single import — re-selecting
   * the tab reuses the resolved module rather than starting over.
   */
  let mapModule = $state.raw<Promise<typeof import('../MapMain.svelte')> | undefined>();

  function onTabChange(value: string) {
    if (value === 'o_map') mapModule ??= import('../MapMain.svelte');
  }
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
            Enregistrez quand un cours n'a pas pu se dérouler parce que le professeur était absent.
          </Card.Description>
        </div>
      </div>
    </Card.Header>
    <Card.Content class=" -mb-(--card-spacing)">
      <Tabs.Root value="o_list" onValueChange={onTabChange} class="mb-4 sm:col-span-2 ">
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
            {#if mapModule}
              {#await mapModule}
                <div class="text-muted-foreground grid h-full place-items-center text-sm">
                  Chargement de la carte…
                </div>
              {:then { default: MapMain }}
                <MapMain bind:selectedSchool />
              {:catch}
                <div class="text-muted-foreground grid h-full place-items-center p-4 text-sm">
                  La carte n'a pas pu être chargée. Utilisez l'onglet « Liste ».
                </div>
              {/await}
            {/if}
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
