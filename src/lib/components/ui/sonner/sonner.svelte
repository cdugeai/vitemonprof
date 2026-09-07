<script lang="ts">
  import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'svelte-sonner';
  import Loader2Icon from '@lucide/svelte/icons/loader-2';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
  import InfoIcon from '@lucide/svelte/icons/info';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

  let { ...restProps }: SonnerProps = $props();
</script>

<!--
  shadcn-svelte generates this with `theme={mode.current}` from `mode-watcher`. Dropped:
  the app has no dark mode and mounts no `<ModeWatcher />`, and merely *reading*
  `mode.current` runs an effect that writes `documentElement.style.colorScheme` from the
  OS preference — which would hand a dark UA stylesheet (form controls, scrollbars) to
  anyone whose system is set to dark, on a site that only has a light palette.
  Re-derive it from `mode-watcher` on the day the app gains a theme switch.
-->
<Sonner
  theme="light"
  class="toaster group"
  style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
  toastOptions={{
    // Sonner's own `richColors` would tint the whole toast; this keeps the neutral popover
    // surface and colours only the icon and the title, which is what the alerts on the
    // page already do — green for a confirmation, the `destructive` token for a failure.
    // `green-700` rather than the alert's `green-900`: the alert says it on a green-tinted
    // background, where a near-black green still reads as green; on the toast's white
    // surface it just reads as black, and the failure toast next to it is vividly red. A `classes` key named after a toast type lands on that toast's root, so
    // the accent is reached from there rather than repeated at every call site.
    //
    // The title needs `!`: sonner ships `[data-sonner-toast] [data-title]{color:…}`, which
    // has the same specificity as the utility and is injected after the stylesheet, so it
    // wins on source order alone. The icon carries no such rule and needs no escape hatch.
    classes: {
      success: '[&_[data-icon]]:text-green-600 [&_[data-title]]:text-green-700!',
      error: '[&_[data-icon]]:text-destructive [&_[data-title]]:text-destructive!',
    },
  }}
  {...restProps}
>
  {#snippet loadingIcon()}
    <Loader2Icon class="size-4 animate-spin" />
  {/snippet}
  {#snippet successIcon()}
    <CircleCheckIcon class="size-4" />
  {/snippet}
  {#snippet errorIcon()}
    <OctagonXIcon class="size-4" />
  {/snippet}
  {#snippet infoIcon()}
    <InfoIcon class="size-4" />
  {/snippet}
  {#snippet warningIcon()}
    <TriangleAlertIcon class="size-4" />
  {/snippet}
</Sonner>
