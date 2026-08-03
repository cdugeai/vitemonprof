<script lang="ts">
  import * as Select from '$lib/components/ui/select/index.js';
  import type { School } from '$lib/types/school';
  import Input from '../ui/input/input.svelte';
  import { Label } from '$lib/components/ui/label';
  import { buildLabelSchool } from '$lib/utils';

  let {
    // eslint-disable-next-line no-useless-assignment
    selectedSchool = $bindable(),
  }: {
    selectedSchool: School | undefined;
  } = $props();

  /** Idle time after the last keystroke before we hit the API. */
  const DEBOUNCE_MS = 250;
  /** Shorter than this and the query matches almost everything — not worth a round trip. */
  const MIN_QUERY_LENGTH = 2;

  let open = $state(false);
  let typedText = $state('');
  let schools: School[] = $state([]);
  let isLoading = $state(false);

  const schoolOptions = $derived(
    schools.map((s) => ({
      value: s.id,
      label: buildLabelSchool(s),
    }))
  );

  let selectedLabel = $derived(selectedSchool ? buildLabelSchool(selectedSchool) : '');
  // The trigger label can't be looked up in `schoolOptions`: the list is whatever the
  // last search returned, and the user typing a new query would blank out their own
  // selection. So capture the label at pick time and keep it.

  const triggerContent = $derived(selectedLabel || 'Sélectionnez un établissement');

  async function fetchSchools(query: string, signal: AbortSignal): Promise<School[]> {
    const params = new URLSearchParams({ query_string: query });
    const res = await fetch(`/api/schools?${params}`, { signal });

    if (!res.ok) {
      throw new Error(`GET /api/schools failed: ${res.status}`);
    }

    return res.json();
  }

  // `$effect` re-runs whenever `typedText` changes. Its cleanup both cancels the pending
  // debounce timer and aborts the in-flight request, which is what keeps a slow earlier
  // response from landing on top of a newer one.
  // Effects never run during SSR, so the relative URL is always browser-side here.
  $effect(() => {
    const query = typedText.trim();

    if (query.length < MIN_QUERY_LENGTH) {
      schools = [];
      isLoading = false;
      return;
    }

    const controller = new AbortController();
    isLoading = true;

    const timer = setTimeout(() => {
      fetchSchools(query, controller.signal)
        .then((r) => (schools = r))
        .catch((err) => {
          if (err.name !== 'AbortError') console.error(err);
        })
        .finally(() => {
          if (!controller.signal.aborted) isLoading = false;
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  function onOpenChange(isOpen: boolean) {
    // Start each visit to the dropdown from a clean search.
    if (!isOpen) typedText = '';
  }

  // Not `$state`: only ever read from event handlers, never from the template.
  let searchInput: HTMLInputElement | null = null;

  /**
   * Grab a handle on the search field and put the caret in it as soon as it mounts.
   *
   * An attachment rather than the `autofocus` attribute because `Select.Content` is only
   * mounted while open, so this re-runs on every open. `requestAnimationFrame` lets the
   * popper finish positioning first — focusing sooner can scroll to where the content
   * *was* — and `preventScroll` covers the rest.
   *
   * This is what handles opening via the keyboard (Enter / Space / ArrowDown).
   */
  function searchField(node: HTMLInputElement) {
    searchInput = node;
    const frame = requestAnimationFrame(() => node.focus({ preventScroll: true }));

    return () => {
      cancelAnimationFrame(frame);
      searchInput = null;
    };
  }

  /**
   * ...and this is what handles opening with the mouse. bits-ui parks focus on the trigger
   * and re-focuses it from its own `onclick` handler, which fires *after* the content has
   * mounted — so the focus above loses that race on a real click, where pointerdown and
   * click straddle a frame. Rather than fight it with a longer timer, bounce focus to the
   * search field whenever the trigger receives it while the dropdown is open. The `open`
   * check keeps the guard inert once closed, so the trigger holds focus normally then.
   */
  function onTriggerFocus() {
    if (open) searchInput?.focus({ preventScroll: true });
  }

  function onValueChange(value: string) {
    // Update School when Id is updated
    selectedSchool = schools.find((sc) => sc.id == value);
  }
</script>

<Select.Root type="single" name="selected_school" bind:open {onOpenChange} {onValueChange}>
  <Label for="sel-school" class="px-1 text-sm font-semibold">Établissement</Label>
  <Select.Trigger
    class="bg-mybeige-bg w-full overflow-hidden"
    onfocus={onTriggerFocus}
    id="sel-school"
  >
    <span class="overflow-hidden">
      {triggerContent}
    </span>
  </Select.Trigger>
  <Select.Content class="max-h-65 ">
    <Select.Group>
      <Select.Label>Établissement</Select.Label>
      <Input bind:value={typedText} class="my-1" placeholder="Rechercher" {@attach searchField} />
      {#each schoolOptions as school_ (school_.value)}
        <Select.Item value={school_.value} label={school_.label}>
          {school_.label}
        </Select.Item>
      {:else}
        <p class="text-muted-foreground px-2 py-3 text-sm">
          {#if isLoading}
            Recherche…
          {:else if typedText.trim().length < MIN_QUERY_LENGTH}
            Tapez au moins {MIN_QUERY_LENGTH} caractères
          {:else}
            Aucun établissement trouvé
          {/if}
        </p>
      {/each}
    </Select.Group>
  </Select.Content>
</Select.Root>
