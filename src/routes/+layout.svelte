<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col">
	<Navbar />
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="bg-gray-800 text-white py-8">
		<div class="max-w-7xl mx-auto px-4 text-center">
			<p>&copy; 2026 ViteMonProf. Track missing professors, improve accountability.</p>
		</div>
	</footer>
</div>
