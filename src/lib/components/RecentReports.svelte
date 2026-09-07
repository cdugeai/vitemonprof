<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import type { MissedHour } from '$lib/types/missedHours';
  import { disciplineLabel } from '$lib/disciplines';
  import { classLevelLabel } from '$lib/classLevels';
  import type { School } from '$lib/types/school';
  import { formatRelativeTime } from '$lib/utils';
  import Inbox from '@lucide/svelte/icons/inbox';

  interface Props {
    missed_hours: MissedHour[];
    is_loading: boolean;
  }

  let { missed_hours, is_loading }: Props = $props();
  const LAST_TO_DISPLAY = 5;
  const SKELETON_ROWS = 3;
  let missed_hours_to_display = $derived(missed_hours.slice(0, LAST_TO_DISPLAY));

  let schools_infos: Map<string, School> = $state(new Map());

  /**
   * Fetch school infos from the API
   * @param ids
   * @param signal
   */
  async function fetchSchoolsInfo(
    ids: string[],
    signal: AbortSignal
  ): Promise<Map<string, School>> {
    const query = new URLSearchParams(ids.map((id) => ['id', id]));
    const res = await fetch(`/api/schools?${query}`, { signal });

    if (!res.ok) {
      throw new Error(`GET /api/schools failed: ${res.status}`);
    }

    const schools: School[] = await res.json();

    return new Map(schools.map((s) => [s.id, s]));
  }

  // `$effect` (not `onMount`) because the ids depend on props: the reports list
  // arrives asynchronously and can change, and onMount would only ever fetch once.
  // Effects never run during SSR, so the relative URL is always browser-side here.
  $effect(() => {
    const ids = [...new Set(missed_hours_to_display.map((mh) => mh.schoolId))];

    if (ids.length === 0) {
      schools_infos = new Map();
      return;
    }

    // Aborting on cleanup drops the in-flight request when the ids change again,
    // so a slow earlier response can never overwrite a newer one.
    const controller = new AbortController();

    fetchSchoolsInfo(ids, controller.signal)
      .then((r) => (schools_infos = r))
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      });

    return () => controller.abort();
  });

  /**
   * A clock the timestamps can depend on.
   *
   * Without it « il y a 1 minute » is computed once and then quietly rots — a
   * panel titled "récents" showing a stale age is worse than showing none. Making
   * `now` reactive state means every `formatRelativeTime` call re-runs on each
   * tick, for free, because they already read it.
   *
   * 30s is chosen against the *display*, not the clock: the coarsest thing this
   * renders is minutes, so a faster tick would re-render without ever changing a
   * character.
   */
  let now = $state(Date.now());

  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  // « 1ère C » when a group was given, plain « 1ère » when it was not — the group
  // is optional, so the label has to read naturally either way.
  //
  // `classLevelLabel` is what was missing: `mh.class` holds the stored id, so this
  // list used to render « 1ere » and « term » at people.
  const classLabel = (mh: MissedHour) => {
    const level = classLevelLabel(mh.class);
    return mh.classGroup ? `${level} ${mh.classGroup}` : level;
  };

  /**
   * Colour encodes *severity*, and severity only.
   *
   * `nbHours` is the one variable here worth a colour: it is ordered, it is the
   * quantity the whole site is about, and four steps fit a ramp people already
   * read (neutral → amber → orange → red). One hour stays deliberately neutral
   * so the ramp starts at "noted", not at "alarming".
   *
   * The discipline deliberately gets *no* colour. It has nineteen values with no
   * inherent order, so colouring it would mean nineteen arbitrary hues — decoration
   * that actively competes with the one signal that means something.
   */
  function hoursTone(hours: number): string {
    if (hours >= 4) return 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200';
    if (hours === 3)
      return 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200';
    if (hours === 2) return 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200';
    return 'bg-muted text-muted-foreground';
  }

  /** Exact timestamp for the tooltip, so the friendly label never costs precision. */
  const exactDate = (iso: string) => new Date(iso).toLocaleString('fr-FR');
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Rapports récents</Card.Title>
    <Card.Description>Les derniers signalements enregistrés.</Card.Description>
  </Card.Header>
  <Card.Content>
    {#if is_loading}
      <!--
        Skeleton rows rather than a centred "Chargement…". They hold the same shape
        as real rows, so the panel does not jump when the data lands — and the
        placeholder itself tells you what is coming.
      -->
      <ul class="space-y-2">
        {#each { length: SKELETON_ROWS }, i (i)}
          <li class="flex animate-pulse items-center gap-3 rounded-xl border p-3">
            <div class="bg-muted size-11 shrink-0 rounded-lg"></div>
            <div class="flex-1 space-y-2">
              <div class="bg-muted h-3.5 w-2/3 rounded"></div>
              <div class="bg-muted h-3 w-1/3 rounded"></div>
            </div>
          </li>
        {/each}
      </ul>
    {:else if missed_hours_to_display.length === 0}
      <div class="flex flex-col items-center gap-2 py-10 text-center">
        <span class="bg-muted text-muted-foreground rounded-full p-3">
          <Inbox class="size-5" />
        </span>
        <p class="text-sm font-medium">Aucun rapport pour le moment</p>
        <p class="text-muted-foreground text-sm">Les signalements envoyés apparaîtront ici.</p>
      </div>
    {:else}
      <!--
        A real `<ul>`/`<li>`: this is a list of five things, and saying so lets a
        screen reader announce "liste de 5 éléments" and navigate item by item.
        The previous stack of `<div>`s carried none of that.
      -->
      <ul class="space-y-2">
        {#each missed_hours_to_display as mh (mh.id)}
          {@const school = schools_infos.get(mh.schoolId)}
          <li
            class="hover:bg-muted/40 flex items-center gap-3 rounded-xl border p-3 transition-colors"
          >
            <!--
              `aria-hidden` on the tile because the sentence below already says
              "2 heures manquées" — without it a screen reader reads "2 h" twice.
              The visual and the accessible name are two renderings of one fact.
            -->
            <span
              class="grid size-11 shrink-0 place-items-center rounded-lg {hoursTone(mh.nbHours)}"
              aria-hidden="true"
            >
              <span class="text-base leading-none font-semibold tabular-nums">
                {mh.nbHours}<span class="text-[0.7em]">h</span>
              </span>
            </span>

            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <!--
                  `line-clamp-2`, not `truncate`: real school names run to
                  « Lycée professionnel Alexandre Bérard - Lycée des métiers de la
                  Plaine de l'Ain et du Bugey », and one truncated line next to a
                  fixed-width timestamp cuts every one of them to "Lycée
                  professionne…" on a phone. Two lines identify the school; the
                  timestamp still aligns to the first baseline.

                  Falls back to the raw UAI code rather than rendering an empty
                  "()" while `/api/schools` is still in flight — or forever, if the
                  id is not in the CSV.
                -->
                <p class="line-clamp-2 text-sm font-medium">{school?.name ?? mh.schoolId}</p>
                <time
                  class="text-muted-foreground shrink-0 text-xs"
                  datetime={mh.createdAt}
                  title={exactDate(mh.createdAt)}
                >
                  {formatRelativeTime(mh.createdAt, now)}
                </time>
              </div>

              {#if school}
                <p class="text-muted-foreground truncate text-xs">
                  {school.postalCode}
                  {school.city}
                </p>
              {/if}

              <div class="mt-1.5 flex flex-wrap items-center gap-1">
                <Badge variant="secondary">{classLabel(mh)}</Badge>
                {#if mh.discipline}
                  <Badge variant="outline">{disciplineLabel(mh.discipline)}</Badge>
                {/if}
                <span class="sr-only">
                  {mh.nbHours} heure{mh.nbHours > 1 ? 's' : ''} manquée{mh.nbHours > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </Card.Content>
</Card.Root>
