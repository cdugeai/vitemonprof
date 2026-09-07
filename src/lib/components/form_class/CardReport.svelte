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
  import SelectorClassGroup from './SelectorClassGroup.svelte';
  import SelectorDiscipline from './SelectorDiscipline.svelte';
  import SelectorSchool from './SelectorSchool.svelte';
  import DatePicker from '../DatePicker.svelte';
  import PresenterSchool from './PresenterSchool.svelte';
  import type { School } from '$lib/types/school';
  import type { ClassGroup } from '$lib/classGroups';
  import type { Discipline } from '$lib/disciplines';
  import type { ClassLevel } from '$lib/classLevels';
  import FormHint from './FormHint.svelte';
  import { dateToStr } from '$lib/utils';
  import NumberHoursInput from './NumberHoursInput.svelte';
  import { preloadSchools } from '$lib/schools-cache';

  interface Props {
    selectedClass?: ClassLevel;
    selectedClassGroup?: ClassGroup;
    selectedDiscipline?: Discipline;
    selectedSchool?: School;
    selectedDate?: CalendarDate;
    nbHours?: number;
    canSubmit: boolean;
    submitting?: boolean;
  }

  let {
    selectedClass = $bindable(),
    selectedClassGroup = $bindable(),
    selectedDiscipline = $bindable(),
    selectedSchool = $bindable(),
    selectedDate = $bindable(),
    nbHours = $bindable(),
    canSubmit = $bindable(),
    submitting = false,
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

  /**
   * Start fetching the two slow things the map needs, before anyone asks for it.
   *
   * Both are idempotent — `??=` here, a memoised promise in `schools-cache` — so
   * this is safe to call from as many events as make sense.
   *
   * Reaching for the tab is a strong enough signal of intent to spend the
   * bandwidth, and it is the only signal available that costs nothing: the
   * ~1 MB MapLibre chunk and the ~2.5 MB registry are both pure waste for the
   * many visitors who only ever use the « Liste » tab, so they must not be
   * fetched on page load.
   *
   * Hover buys the most (a few hundred milliseconds between reaching and
   * clicking), focus covers keyboard users, and on a touchscreen `pointerenter`
   * fires just before the tap — barely any lead time, but nothing lost either.
   */
  function preloadMap() {
    mapModule ??= import('../MapMain.svelte');
    preloadSchools();
  }

  function onTabChange(value: string) {
    if (value === 'o_map') preloadMap();
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
          <Tabs.Trigger value="o_map" onpointerenter={preloadMap} onfocus={preloadMap}>
            <MapPin />
            Carte
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="o_list">
          <SelectorSchool bind:selectedSchool />
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
          <SelectorClassGroup bind:selectedClassGroup />
          <SelectorDiscipline bind:selectedDiscipline />
          <DatePicker bind:date_={selectedDate} />
          <NumberHoursInput bind:nbHours />
        </div>
      </Tabs.Root>
      <FormHint {selectedSchool} {selectedClass} selectedDate={dateToStr(selectedDate)} />

      <Button type="submit" class="mb-3 w-full rounded-xl p-5" disabled={!canSubmit || submitting}>
        <Send />
        <span>{submitting ? 'Envoi en cours…' : 'Envoyer le rapport'}</span>
      </Button>
    </Card.Content>
  </Card.Root>
</div>
