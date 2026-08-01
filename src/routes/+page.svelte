<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import MapMain from '$lib/components/MapMain.svelte';
</script>

<div class="mx-auto max-w-7xl px-4 py-8">
  <!-- Hero Section -->
  <section class="mb-12">
    <div class="rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
      <h1 class="mb-4 text-4xl font-bold">Track Missing Professors</h1>
      <p class="text-lg">
        Help your school community stay informed about class cancellations and professor
        availability.
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
        <Card.Content>
          <div class="flex h-96 items-center justify-center rounded-lg bg-gray-100">
            <div class="text-center text-gray-600">
              <p class="text-lg font-semibold">Interactive Map</p>
              <MapMain />
              <p class="text-sm">Click on a school to report missing professors</p>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </section>

    <!-- Report Section (Right) -->
    <section>
      <Card.Root>
        <Card.Header>
          <Card.Title>Report Missing Professor</Card.Title>
        </Card.Header>
        <Card.Content>
          <form class="space-y-4">
            <div class="space-y-2">
              <Label for="school">School</Label>
              <Input id="school" type="text" placeholder="Select school..." />
            </div>

            <div class="space-y-2">
              <Label for="professor">Professor Name</Label>
              <Input id="professor" type="text" placeholder="Professor name..." />
            </div>

            <div class="space-y-2">
              <Label for="class">Class</Label>
              <Input id="class" type="text" placeholder="Class name..." />
            </div>

            <div class="space-y-2">
              <Label for="time">Time Missed</Label>
              <Input id="time" type="datetime-local" />
            </div>

            <Button type="submit" class="w-full" variant="outline">Submit Report</Button>
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
            <p class="text-sm text-gray-600">Total Reports</p>
          </div>
          <div class="rounded-lg bg-yellow-50 p-4 text-center">
            <p class="text-3xl font-bold text-yellow-600">0</p>
            <p class="text-sm text-gray-600">Schools Tracked</p>
          </div>
          <div class="rounded-lg bg-red-50 p-4 text-center">
            <p class="text-3xl font-bold text-red-600">0</p>
            <p class="text-sm text-gray-600">Professors Flagged</p>
          </div>
          <div class="rounded-lg bg-green-50 p-4 text-center">
            <p class="text-3xl font-bold text-green-600">0</p>
            <p class="text-sm text-gray-600">This Week</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </section>
</div>
