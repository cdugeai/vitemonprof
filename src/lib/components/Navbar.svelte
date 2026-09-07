<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
</script>

<nav class="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="flex h-16 items-center justify-between">
      <!-- Logo/Title -->
      <div class="flex-shrink-0">
        <a href="/" class="text-2xl font-bold transition hover:text-blue-100"> ViteMonProf </a>
      </div>

      <!-- Navigation Links -->
      <div class="flex gap-2">
        <Button
          variant={$page.url.pathname === '/' ? 'default' : 'ghost'}
          class={$page.url.pathname === '/'
            ? ''
            : 'text-white hover:bg-blue-500/20 hover:text-white'}
          href="/"
        >
          Home
        </Button>
        <Button
          variant={$page.url.pathname === '/dashboard' ? 'default' : 'ghost'}
          class={$page.url.pathname === '/dashboard'
            ? ''
            : 'text-white hover:bg-blue-500/20 hover:text-white'}
          href="/dashboard"
        >
          Dashboard
        </Button>
        <Button
          variant={$page.url.pathname === '/about' ? 'default' : 'ghost'}
          class={$page.url.pathname === '/about'
            ? ''
            : 'text-white hover:bg-blue-500/20 hover:text-white'}
          href="/about"
        >
          About
        </Button>
      </div>
    </div>
  </div>
</nav>
