<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import Navbar from '$lib/components/Navbar.svelte';
  // Importing the file (rather than hardcoding a path) hands Vite the asset so the URL
  // carries the same content hash as the one in the stylesheet — a hardcoded path would
  // preload a *different* URL and cost an extra download instead of saving one.
  import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <!-- Without this the font is only discovered once the browser has downloaded and parsed
       app.css, then matched a glyph against the `unicode-range` — two round trips deep into
       the load. Preloading starts it with the HTML, which shortens the `swap` flash of
       fallback text. `crossorigin` is required even same-origin: fonts are fetched in CORS
       mode, and a preload whose mode doesn't match is discarded and fetched again. -->
  <link rel="preload" href={interLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <Navbar />
  <main class="flex-1">
    {@render children()}
  </main>
  <footer class="bg-gray-800 py-8 text-white">
    <div class="mx-auto max-w-7xl px-4 text-center">
      <p>&copy; 2026 ViteMonProf. Suivre les heures manquées, améliorer l'éducation.</p>
    </div>
  </footer>
</div>
