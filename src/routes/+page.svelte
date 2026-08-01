<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import MapMain from '$lib/components/MapMain.svelte';
  import SelectorClass from '$lib/components/form_class/SelectorClass.svelte';
  import type { School } from '$lib/types/school';
  import PresenterSchool from '$lib/components/form_class/PresenterSchool.svelte';
  import RecentReports from '$lib/components/RecentReports.svelte';

  const DEFAULT_NB_HOURS = 1;

  let selectedClass: string = $state('none');
  let selectedSchool: School | null = $state(null);
  let selectedNbHours: number | null = $state(DEFAULT_NB_HOURS);
  let selectedDate: string = $state('');

  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-7xl px-4 py-8">
  <!-- Hero Section -->
  <section class="mb-12">
    <div class="rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
      <h1 class="mb-4 text-4xl font-bold">Track Missed Hours</h1>
      <p class="text-lg">
        Keep track of missed classes and accumulated hours across your school community.
      </p>
    </div>
  </section>

  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
    <!-- Map Section (Left - 2 cols) -->
    <section class="lg:col-span-2">
      <Card.Root>
        <Card.Header>
          <Card.Title>School Locator</Card.Title>
        </Card.Header>
        <Card.Content class="p-0">
          <div class="h-96 rounded-lg bg-gray-100">
            <MapMain bind:selectedSchool />
          </div>
        </Card.Content>
      </Card.Root>
    </section>

    <!-- Report Section (Right) -->
    <section>
      <Card.Root>
        <Card.Header>
          <Card.Title>Log Missed Hours</Card.Title>
        </Card.Header>
        <Card.Content>
          <form method="POST" class="space-y-4">
            <div class="space-y-2">
              <Label for="school">School</Label>
              <Input id="school" type="text" name="schoolId" value={selectedSchool?.id} hidden />
              <PresenterSchool school={selectedSchool} />
            </div>

            <div class="space-y-2">
              <Label for="class">Class</Label>
              <SelectorClass bind:selectedClass />
              <Input name="class" value={selectedClass} hidden />
            </div>

            <div class="flex flex-wrap gap-x-3">
              <div class="space-y-2">
                <Label for="date">Date Missed</Label>
                <Input id="date" type="date" name="date" bind:value={selectedDate} required />
              </div>
              <div class="space-y-2">
                <Label for="nb_hours">Number of class hours</Label>
                <Input
                  id="nb_hours"
                  type="number"
                  name="nbHours"
                  max="4"
                  min="1"
                  step="1"
                  defaultValue={DEFAULT_NB_HOURS}
                  bind:value={selectedNbHours}
                  required
                />
              </div>
            </div>

            <Button type="submit" class="w-full" variant="outline">Log Hours</Button>
          </form>
        </Card.Content>
      </Card.Root>
    </section>
  </div>

  <!-- Statistics Preview Section -->
  <section class="mt-12">
    <Card.Root>
      <Card.Header>
        <Card.Title>Statistics Overview</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div class="rounded-lg bg-blue-50 p-4 text-center">
            <p class="text-3xl font-bold text-blue-600">0</p>
            <p class="text-sm text-gray-600">Total Hours Missed</p>
          </div>
          <div class="rounded-lg bg-yellow-50 p-4 text-center">
            <p class="text-3xl font-bold text-yellow-600">0</p>
            <p class="text-sm text-gray-600">Schools Tracked</p>
          </div>
          <div class="rounded-lg bg-red-50 p-4 text-center">
            <p class="text-3xl font-bold text-red-600">0</p>
            <p class="text-sm text-gray-600">Classes Affected</p>
          </div>
          <div class="rounded-lg bg-green-50 p-4 text-center">
            <p class="text-3xl font-bold text-green-600">0</p>
            <p class="text-sm text-gray-600">This Week</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </section>

  <!-- Recent reports-->
  <section class="mt-12">
    {#await data.missed_hours}
      <p>LOADING</p>
      <RecentReports missed_hours={[]} />
    {:then mh}
      <p>LOADED</p>
      <RecentReports missed_hours={mh} />
    {/await}
  </section>
</div>
