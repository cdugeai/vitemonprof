<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  /**
   * The trigger, and nothing else. Everything the dialog needs — bits-ui's
   * dialog (focus trap, scroll lock, portal) plus the QR encoder — is imported
   * on demand.
   *
   * That is worth the indirection: eagerly, this feature added ~8.8 kB gzipped
   * to the layout chunk, which every page of the site downloads. The layout
   * chunk was 11.7 kB. Nearly doubling the JS on every visit for a dialog most
   * visitors never open is the wrong trade, and it is the same reasoning
   * `$lib/gzip-json` uses when it splits pako so the client only ships inflate.
   *
   * The usual cost of a dynamic import — the first click waiting on a network
   * round trip — is paid off by prefetching on hover and focus, which is what
   * SvelteKit itself does for links.
   */

  /** Props to spread onto whatever element the caller renders as the trigger. */
  type TriggerProps = {
    onclick: () => void;
    onpointerenter: () => void;
    onfocus: () => void;
    'aria-haspopup': 'dialog';
    'aria-expanded': boolean;
  };

  interface Props {
    /**
     * The element that opens the dialog. Passed in rather than built here so the
     * footer link and the navbar icon button can look nothing alike while
     * sharing one implementation.
     */
    trigger: Snippet<[TriggerProps]>;
  }

  let { trigger }: Props = $props();

  let open = $state(false);
  let Content = $state<Component<{ open: boolean }> | null>(null);

  /**
   * Idempotent and safe to call on every hover: `import()` caches the module, so
   * repeat calls resolve from memory without a second request.
   */
  let pending: Promise<void> | null = null;
  function load() {
    pending ??= import('./ShareDialogContent.svelte').then((module) => {
      Content = module.default;
    });
    return pending;
  }

  async function show() {
    await load();
    open = true;
  }
</script>

{@render trigger({
  onclick: show,
  onpointerenter: load,
  onfocus: load,
  'aria-haspopup': 'dialog',
  'aria-expanded': open,
})}

<!--
  Kept mounted once loaded rather than torn down on close: the component holds
  no state worth discarding, and remounting it would replay the open animation
  from scratch every time.
-->
{#if Content}
  <Content bind:open />
{/if}
