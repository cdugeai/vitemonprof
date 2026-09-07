<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { DEPARTEMENTS, departementLabel } from '$lib/departements';
  import { createSelectSearchFocus } from '$lib/components/form_class/searchableSelect';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import Seo from '$lib/components/Seo.svelte';
  import ChartNoAxesColumn from '@lucide/svelte/icons/chart-no-axes-column';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const ALL_DEPARTEMENTS = 'all';

  /** Mirrors `TOP_LIMIT`, which lives in a server-only module. */
  const TOP_LIMIT = 5;

  let open = $state(false);
  let typedText = $state('');

  // The same focus dance the report form's selects use: without it bits-ui parks
  // focus on the trigger, and with 107 départements the list scrolls to the
  // current selection — so the search field is both unfocused *and* off-screen,
  // and typing goes to the Select's own single-letter typeahead instead.
  const search = createSelectSearchFocus(() => open);

  // Filtered on the label so « 75 » and « Paris » both find Paris — the codes are
  // what people know for their own département and the names for everyone else's.
  let options = $derived(
    DEPARTEMENTS.map((d) => ({ value: d.code, label: departementLabel(d.code) })).filter(
      (o) => typedText === '' || o.label.toLowerCase().includes(typedText.toLowerCase())
    )
  );

  let departementValue = $derived(data.departement ?? ALL_DEPARTEMENTS);

  let triggerContent = $derived(
    data.departement ? departementLabel(data.departement) : 'Toute la France'
  );

  /**
   * Both selectors write to the URL rather than to local state, which is what
   * makes the view linkable and the back button meaningful — `load` re-runs and
   * re-queries on its own.
   *
   * `keepFocus` so the control you just used does not lose focus under you, and
   * `noScroll` so changing a filter does not throw you back to the top of the
   * page.
   */
  function navigate(key: 'departement' | 'dimension', value: string) {
    // Copied from `page.url` rather than built from scratch, so changing one
    // selector cannot drop the other one's parameter.
    //
    // The disable is narrow and deliberate: this is a throwaway built inside an
    // event handler and serialised three lines later. Nothing reads it
    // reactively, so `SvelteURLSearchParams` would buy a proxy for no
    // subscriber.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const params = new URLSearchParams(page.url.searchParams);

    if (value === ALL_DEPARTEMENTS) params.delete(key);
    else params.set(key, value);

    // `resolve()` rather than a bare `?…`, so this keeps working if the app is
    // ever served from a sub-path — that is what the rule below is protecting.
    // It only recognises a bare `resolve()` call as the whole argument though,
    // and the query string has to be appended somewhere, so it needs telling.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    goto(`${resolve('/dashboard')}?${params}`, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
    });
  }

  /**
   * A ranking of départements narrowed to one département is a ranking of one
   * row, so the card stops claiming to be a top 5 and says what it now is: that
   * zone's total. The discipline ranking is unaffected — narrowing it still
   * leaves five subjects to rank.
   */
  let singleZone = $derived(data.dimension === 'departement' && data.departement !== null);

  let heading = $derived(
    data.dimension === 'discipline'
      ? 'Matières les plus concernées'
      : singleZone
        ? 'Heures non remplacées'
        : 'Départements les plus concernés'
  );

  let scope = $derived(
    data.departement ? `Département ${departementLabel(data.departement)}` : 'Toute la France'
  );

  let subtitle = $derived(
    singleZone
      ? `${scope} — total des heures soumises.`
      : `${scope} — top ${TOP_LIMIT} par heures manquées.`
  );

  /**
   * The bar length, as a share of the leader rather than of some fixed maximum.
   *
   * A top-5 has no meaningful absolute scale — 40 hours is a lot in one
   * département and nothing in another — so the leader is the ruler, and the bars
   * say "relative to the worst case here". The number next to it carries the
   * absolute value.
   */
  function share(hours: number, max: number): string {
    return `${max > 0 ? Math.max((hours / max) * 100, 2) : 0}%`;
  }
</script>

<Seo
  title="Tableau de bord"
  description="Les heures de cours non remplacées les plus souvent soumises, département par département. Chaque créneau est compté une seule fois."
/>

<div class="mx-auto max-w-4xl px-4 py-8">
  <h1 class="mb-2 text-3xl font-bold">Tableau de bord</h1>
  <p class="text-muted-foreground mb-8">
    Les heures non remplacées les plus souvent soumises, par département. Chaque créneau est compté
    une seule fois, quel que soit le nombre de contributeurs.
  </p>

  <div class="mb-6 grid gap-4 sm:grid-cols-2">
    <div class="flex flex-col gap-2">
      <Label for="dash-dept" class="px-1">Département</Label>
      <Select.Root
        type="single"
        bind:open
        value={departementValue}
        onOpenChange={(isOpen) => {
          // Every visit to the dropdown starts from an empty search.
          if (!isOpen) typedText = '';
        }}
        onValueChange={(value) => navigate('departement', value)}
      >
        <Select.Trigger class="bg-mybeige-bg w-full" id="dash-dept" onfocus={search.onTriggerFocus}>
          {triggerContent}
        </Select.Trigger>
        <Select.Content class="max-h-65">
          <Select.Group>
            <Select.Label>Département</Select.Label>
            <Input
              bind:value={typedText}
              class="my-1"
              placeholder="Rechercher"
              {@attach search.field}
            />
            <Select.Item value={ALL_DEPARTEMENTS} label="Toute la France">
              Toute la France
            </Select.Item>
            {#each options as option (option.value)}
              <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </div>

    <div class="flex flex-col gap-2">
      <!--
        A segmented control rather than a second dropdown: with exactly two
        mutually exclusive options, a `<select>` costs three interactions to show
        two choices that fit side by side.
      -->
      <span id="dash-dimension-label" class="px-1 text-sm leading-none font-medium select-none">
        Classer par
      </span>
      <ToggleGroup.Root
        type="single"
        variant="outline"
        size="lg"
        aria-labelledby="dash-dimension-label"
        class="w-full"
        bind:value={() => data.dimension, (value) => value && navigate('dimension', value)}
      >
        <ToggleGroup.Item
          value="departement"
          class="bg-mybeige-bg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 flex-1"
        >
          Département
        </ToggleGroup.Item>
        <ToggleGroup.Item
          value="discipline"
          class="bg-mybeige-bg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-11 flex-1"
        >
          Matière
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    </div>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{heading}</Card.Title>
      <Card.Description>{subtitle}</Card.Description>
    </Card.Header>
    <Card.Content>
      {#await data.ranking}
        <!-- One placeholder when only one row can come back, so the card does
             not collapse from five rows to one as the ranking resolves. -->
        <ul class="space-y-2">
          {#each { length: singleZone ? 1 : TOP_LIMIT }, i (i)}
            <li class="flex animate-pulse items-center gap-3 rounded-xl border p-3">
              {#if !singleZone}
                <div class="bg-muted size-8 shrink-0 rounded-lg"></div>
              {/if}
              <div class="flex-1 space-y-2">
                <div class="bg-muted h-3.5 w-2/3 rounded"></div>
                <div class="bg-muted h-3 w-1/3 rounded"></div>
              </div>
            </li>
          {/each}
        </ul>
      {:then ranking}
        {#if ranking.length === 0}
          <div class="flex flex-col items-center gap-2 py-10 text-center">
            <span class="bg-muted text-muted-foreground rounded-full p-3">
              <ChartNoAxesColumn class="size-5" />
            </span>
            <p class="text-sm font-medium">Aucune soumission ici pour le moment</p>
            <p class="text-muted-foreground text-sm">
              {data.departement
                ? 'Aucune heure non remplacée n’a encore été soumise dans ce département.'
                : 'Aucune heure non remplacée n’a encore été soumise.'}
            </p>
          </div>
        {:else}
          {@const max = ranking[0].totalHours}
          <ol class="space-y-2">
            {#each ranking as entry, index (entry.key)}
              <li class="flex items-center gap-3 rounded-xl border p-3">
                <!--
                  No rank badge on a ranking of one. `aria-hidden` already
                  keeps it out of the accessible name — it is a second
                  rendering of the row’s position — and a lone « 1 » in front
                  of a département reads as "first in France", which is the one
                  thing this view is not saying.
                -->
                {#if !singleZone}
                  <span
                    class="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                {/if}

                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline justify-between gap-2">
                    <p class="line-clamp-2 text-sm font-medium">{entry.label}</p>
                    <p class="shrink-0 text-sm font-semibold tabular-nums">
                      {entry.totalHours}
                      <span class="text-muted-foreground font-normal">h</span>
                    </p>
                  </div>

                  <!--
                    `aria-hidden`, because the row already states the hours and
                    the report count in text. The bar is a second rendering of
                    the same fact, not a fact of its own — and it is measured
                    against the leader, so on a ranking of one there is nothing
                    for it to say. A lone full-width bar would read as a gauge
                    at its maximum rather than as the top of a scale of one.
                  -->
                  {#if !singleZone}
                    <div
                      class="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full"
                      aria-hidden="true"
                    >
                      <div
                        class="bg-primary h-full rounded-full"
                        style:width={share(entry.totalHours, max)}
                      ></div>
                    </div>
                  {/if}

                  <!--
                    Two numbers, because they mean different things: the ranking
                    counts distinct missed hours, and the submissions behind them
                    are the corroboration.

                    Always both, with no condition. This line is the only place
                    corroboration appears on the dashboard — there is no
                    « Soumis N fois » badge here — so a number that comes and
                    goes would make its absence ambiguous. Shown every time, the
                    pair reads as a ratio the eye can compare down the column:
                    « 3 créneaux · 3 soumissions » is three lone reports, and
                    « 3 créneaux · 12 soumissions » is the same three hours with
                    real weight behind them.
                  -->
                  <p class="text-muted-foreground mt-1 text-xs">
                    {entry.events} créneau{entry.events > 1 ? 'x' : ''}
                    <span aria-hidden="true">·</span>
                    {entry.submissions} soumission{entry.submissions > 1 ? 's' : ''}
                  </p>
                </div>
              </li>
            {/each}
          </ol>
        {/if}
      {/await}
    </Card.Content>
  </Card.Root>
</div>
