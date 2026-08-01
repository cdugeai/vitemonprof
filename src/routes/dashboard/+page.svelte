<script lang="ts">
  import * as Card from '$lib/components/ui/card';
</script>

<div class="mx-auto max-w-7xl px-4 py-8">
  <h1 class="mb-8 text-3xl font-bold">Dashboard</h1>

  <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
    <!-- Reports Chart -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Reports Over Time</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="flex h-64 items-center justify-center rounded bg-gray-100 text-gray-500">
          Chart placeholder
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Top Professors -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Most Reported Professors</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b pb-2">
            <span>Loading...</span>
            <span class="text-gray-500">0 reports</span>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Top Schools -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Schools with Most Reports</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b pb-2">
            <span>Loading...</span>
            <span class="text-gray-500">0 reports</span>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Recent Reports -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Recent Reports</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="space-y-3">
          <div class="py-8 text-center text-gray-500">No reports yet</div>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>
