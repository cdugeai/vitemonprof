<script lang="ts">
	import * as Card from '$lib/components/ui/card';
</script>

<div class="max-w-7xl mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-8">Dashboard</h1>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Reports Chart -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Reports Over Time</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="bg-gray-100 rounded h-64 flex items-center justify-center text-gray-500">
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
					<div class="flex justify-between items-center pb-2 border-b">
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
					<div class="flex justify-between items-center pb-2 border-b">
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
					<div class="text-gray-500 py-8 text-center">
						No reports yet
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
