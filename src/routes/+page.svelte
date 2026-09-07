<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
</script>

<div class="max-w-7xl mx-auto px-4 py-8">
	<!-- Hero Section -->
	<section class="mb-12">
		<div class="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-8">
			<h1 class="text-4xl font-bold mb-4">Track Missing Professors</h1>
			<p class="text-lg">Help your school community stay informed about class cancellations and professor availability.</p>
		</div>
	</section>

	<!-- Main Content Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
		<!-- Map Section (Left - 2 cols) -->
		<section class="lg:col-span-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>School Locator</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
						<div class="text-center text-gray-600">
							<p class="text-lg font-semibold">Interactive Map</p>
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
							<Input
								id="school"
								type="text"
								placeholder="Select school..."
							/>
						</div>

						<div class="space-y-2">
							<Label for="professor">Professor Name</Label>
							<Input
								id="professor"
								type="text"
								placeholder="Professor name..."
							/>
						</div>

						<div class="space-y-2">
							<Label for="class">Class</Label>
							<Input
								id="class"
								type="text"
								placeholder="Class name..."
							/>
						</div>

						<div class="space-y-2">
							<Label for="time">Time Missed</Label>
							<Input
								id="time"
								type="datetime-local"
							/>
						</div>

						<Button type="submit" class="w-full">
							Submit Report
						</Button>
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
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="bg-blue-50 rounded-lg p-4 text-center">
						<p class="text-3xl font-bold text-blue-600">0</p>
						<p class="text-sm text-gray-600">Total Reports</p>
					</div>
					<div class="bg-yellow-50 rounded-lg p-4 text-center">
						<p class="text-3xl font-bold text-yellow-600">0</p>
						<p class="text-sm text-gray-600">Schools Tracked</p>
					</div>
					<div class="bg-red-50 rounded-lg p-4 text-center">
						<p class="text-3xl font-bold text-red-600">0</p>
						<p class="text-sm text-gray-600">Professors Flagged</p>
					</div>
					<div class="bg-green-50 rounded-lg p-4 text-center">
						<p class="text-3xl font-bold text-green-600">0</p>
						<p class="text-sm text-gray-600">This Week</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</section>
</div>
