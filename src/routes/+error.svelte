<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import type { LayoutData } from './$types';

  interface Props {
    data: LayoutData;
  }

  const { data }: Props = $props();
</script>

<svelte:head>
  <title>Erreur — ViteMonProf</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
  <div class="mx-auto max-w-md text-center">
    <div class="mb-6 flex justify-center">
      <AlertTriangle class="h-16 w-16 text-red-500" />
    </div>

    <h1 class="mb-2 text-3xl font-bold text-gray-900">
      Une erreur s'est produite
    </h1>

    <p class="mb-6 text-gray-600">
      Quelque chose s'est mal passé. Veuillez réessayer ou retourner à l'accueil.
    </p>

    <Button href="/" class="w-full">
      Retour à l'accueil
    </Button>
  </div>
</div>
