<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { toast } from 'svelte-sonner';
  import CheckIcon from '@lucide/svelte/icons/check';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import Share2Icon from '@lucide/svelte/icons/share-2';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import QrCode from '$lib/components/QrCode.svelte';
  import { shareUrl } from '$lib/shareUrl';
  import { SITE_DESCRIPTION, SITE_NAME } from '$lib/seo';

  interface Props {
    /**
     * Bound by `ShareDialog.svelte`, which opens the dialog in the same tick it
     * finishes importing this module. There is no `Dialog.Trigger` here: the
     * trigger has to exist before this file does.
     */
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  /**
   * `page.url` is the request URL during SSR and the live one after hydration,
   * so this needs no hardcoded domain — the same reasoning as `Seo.svelte`.
   * `$derived` because the dialog lives in the layout and outlives navigations:
   * open it on the dashboard and it must offer the dashboard.
   */
  const url = $derived(shareUrl(page.url));

  /**
   * The Web Share API is a mobile browser thing, and reading `navigator` at
   * module scope would break SSR. `onMount` also means the button is absent
   * from the server HTML and appears at hydration — correct, since it cannot
   * work before then anyway.
   */
  let canShare = $state(false);
  onMount(() => {
    canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  });

  /** Flips the copy button's icon for a moment; the toast is the real feedback. */
  let justCopied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout>;

  async function copyLink() {
    try {
      // Undefined outside a secure context — an http:// preview on a LAN IP is
      // the realistic case. The readonly field below is why that is survivable.
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
      justCopied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (justCopied = false), 2000);
    } catch {
      toast.error('Copie impossible', {
        description: 'Sélectionnez le lien ci-dessous pour le copier à la main.',
      });
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: SITE_NAME, text: SITE_DESCRIPTION, url });
    } catch (error) {
      // Dismissing the share sheet rejects with AbortError. That is the user
      // changing their mind, not a failure, and must not raise a red toast.
      if ((error as Error)?.name !== 'AbortError') {
        toast.error("Le partage n'a pas pu s'ouvrir");
      }
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title>Partager ViteMonProf</Dialog.Title>
      <Dialog.Description>
        Faites scanner ce code, ou copiez le lien de cette page.
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-3">
      {#if canShare}
        <Button onclick={nativeShare} class="w-full">
          <Share2Icon />
          Partager…
        </Button>
      {/if}

      <Button variant={canShare ? 'outline' : 'default'} onclick={copyLink} class="w-full">
        {#if justCopied}
          <CheckIcon />
          Lien copié
        {:else}
          <CopyIcon />
          Copier le lien
        {/if}
      </Button>

      <!--
        Not decoration: this is what makes a failed `navigator.clipboard` a
        nuisance rather than a dead end, and it is what the E2E test reads.
        `readonly` rather than `disabled` — a disabled field cannot be selected.
      -->
      <Input
        value={url}
        readonly
        aria-label="Lien à partager"
        class="text-center text-xs"
        onfocus={(event) => event.currentTarget.select()}
      />

      <!-- The white panel is part of the code: the page ground is beige, and a
           QR needs a light quiet zone around it to be read at all. -->
      <div class="flex justify-center">
        <QrCode
          value={url}
          label="Code QR vers {url}"
          class="w-48 max-w-full rounded-lg ring-1 ring-black/5"
        />
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
