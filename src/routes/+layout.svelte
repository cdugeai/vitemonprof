<script lang="ts">
  import '../app.css';
  // `resolve` turns a route id into a real URL — it applies `paths.base` and is checked
  // against the actual route tree at build time, so a renamed or deleted route becomes a
  // compile error instead of a dead link. `svelte/no-navigation-without-resolve` enforces
  // it, which is why a bare `href="/mentions-legales"` fails `npm run lint`.
  import { resolve } from '$app/paths';
  import favicon from '$lib/assets/favicon.svg';
  import Navbar from '$lib/components/Navbar.svelte';
  // Mounted once here rather than per-page: the toaster is the single portal every
  // `toast()` call renders into, and living in the layout means a toast raised just
  // before a navigation isn't torn down with the page that raised it.
  import { Toaster } from '$lib/components/ui/sonner';
  // Importing the file (rather than hardcoding a path) hands Vite the asset so the URL
  // carries the same content hash as the one in the stylesheet — a hardcoded path would
  // preload a *different* URL and cost an extra download instead of saving one.
  import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2';

  import { dev } from '$app/environment';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';

  injectAnalytics({ mode: dev ? 'development' : 'production' });
  let { children } = $props();

  const CONTACT_EMAIL = 'contact@vitemonprof.fr';
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

<Toaster />

<div class="flex min-h-screen flex-col">
  <Navbar />
  <main class="flex-1">
    {@render children()}
  </main>
  <footer class="bg-gray-800 py-8 text-white">
    <div class="mx-auto max-w-7xl space-y-3 px-4 text-center">
      <nav class="text-sm text-gray-300">
        <a
          class="hover:text-white hover:underline"
          target="_blank"
          href="https://www.data.gouv.fr/datasets/vitemonprof-soumissions"
        >
          Télécharger les données
        </a>
        <span>·</span>
        <a class="hover:text-white hover:underline" href={'mailto:' + CONTACT_EMAIL}>
          Nous écrire
        </a>

        <span>·</span>
        <a
          href="https://github.com/cdugeai/vitemonprof"
          target="_blank"
          class="hover:text-white hover:underline"
        >
          Github
        </a>
        <span>·</span>
        <a class="hover:text-white hover:underline" href={resolve('/mentions-legales')}>
          Mentions légales
        </a>
        <p>&copy; 2026 ViteMonProf</p>
      </nav>
    </div>
  </footer>
</div>
