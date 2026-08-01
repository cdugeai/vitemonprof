<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import Navbar from '$lib/components/Navbar.svelte';

  let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
  <Navbar />
  <main class="flex-1">
    {@render children()}
  </main>
  <footer class="bg-gray-800 py-8 text-white">
    <div class="mx-auto max-w-7xl px-4 text-center">
      <p>&copy; 2026 ViteMonProf. Track missed hours, improve education.</p>
    </div>
  </footer>
</div>
