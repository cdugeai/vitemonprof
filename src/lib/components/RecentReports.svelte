<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import type { MissedHour } from '$lib/types/missedHours';
  import type { School } from '$lib/types/school';

  interface Props {
    missed_hours: MissedHour[];
    is_loading: boolean;
  }

  let { missed_hours, is_loading }: Props = $props();
  const LAST_TO_DISPLAY = 5;
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

  const diffMinutes = (ts: string) => (Date.now() - new Date(ts).getTime()) / 1000 / 60;

  // « 6e A » when a group was given, plain « 6e » when it was not — the group is
  // optional, so the label has to read naturally either way.
  const classLabel = (mh: MissedHour) =>
    mh.classGroup ? `${mh.class} ${mh.classGroup}` : mh.class;
</script>

<!-- Recent Reports -->
<Card.Root>
  <Card.Header>
    <Card.Title>Rapports récents</Card.Title>
  </Card.Header>
  <Card.Content>
    <div class="space-y-3">
      {#if is_loading}
        <div class="py-8 text-center text-gray-500">Chargement des rapports récents...</div>
      {:else if missed_hours.length < 1}
        <div class="py-8 text-center text-gray-500">Aucun rapport pour le moment</div>
      {:else}
        {#each missed_hours_to_display as mh (mh.uuid)}
          {@const school_info = schools_infos.get(mh.schoolId)}
          <div class="flex gap-2">
            <p>{Math.trunc(diffMinutes(mh.createdAt))} min -</p>
            <p>{school_info?.name} ({school_info?.postalCode}) -</p>
            <p>{mh.nbHours} heure(s) dans {classLabel(mh)}</p>
          </div>
        {/each}
      {/if}
    </div>
  </Card.Content>
</Card.Root>
