<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import BookOpen from '@lucide/svelte/icons/book-open';
</script>

<nav class="border-b bg-white shadow-sm">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <!-- Header Row: Logo and Region -->
    <div class="flex min-h-16 items-center justify-between gap-2 py-2">
      <!-- Logo and Brand -->
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div
          class="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <BookOpen class="h-5 w-5" />
        </div>
        <div class="flex min-w-0 flex-col">
          <a
            href="/"
            class="hover:text-primary w-fit text-lg font-bold whitespace-nowrap text-gray-900 transition"
          >
            ViteMonProf
          </a>
          <!-- The tagline is the only part allowed to lose room: it scrolls
               inside its own box so the logo, the name and the badge stay put. -->
          <span
            class="no-scrollbar overflow-x-auto overscroll-x-contain text-xs whitespace-nowrap text-gray-600"
            >L'observatoire participatif des heures non remplacées</span
          >
        </div>
      </div>

      <!-- Region Badge -->
      <div
        class="shrink-0 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-900"
      >
        France
      </div>
    </div>

    <!-- Navigation Links -->
    <div class="flex flex-wrap gap-2 border-t py-2">
      <Button
        variant={$page.url.pathname === '/' ? 'default' : 'ghost'}
        class={$page.url.pathname === '/'
          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
          : 'text-gray-700 hover:bg-gray-100'}
        href="/"
      >
        Accueil
      </Button>
      <Button
        variant={$page.url.pathname === '/dashboard' ? 'default' : 'ghost'}
        class={$page.url.pathname === '/dashboard'
          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
          : 'text-gray-700 hover:bg-gray-100'}
        href="/dashboard"
      >
        Tableau de bord
      </Button>
      <Button
        variant={$page.url.pathname === '/about' ? 'default' : 'ghost'}
        class={$page.url.pathname === '/about'
          ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
          : 'text-gray-700 hover:bg-gray-100'}
        href="/about"
      >
        À propos
      </Button>
    </div>
  </div>
</nav>
