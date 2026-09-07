<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import type { School } from '$lib/types/school';
  import RecentReports from '$lib/components/RecentReports.svelte';
  import type { PageProps } from './$types';
  import { canSubmitForm } from '$lib/utils_form';
  import { onMount } from 'svelte';
  import CardReport from '$lib/components/form_class/CardReport.svelte';
  import { CalendarDate } from '@internationalized/date';
  import { dateToStr } from '$lib/utils';

  let selectedClass: string | undefined = $state();
  let selectedSchool: School | undefined = $state();
  let selectedDate: CalendarDate | undefined = $state();
  let selectedDept: string | undefined = $state();
  let nbHours: number = $state(1);

  let stats_total_hours = $state('-');
  let stats_total_hours_last_7d = $state('-');
  let stats_classes_affected = $state('-');
  let stats_schools_affected = $state('-');

  // Update stats when available
  onMount(async () => {
    let r = await data.missed_hours_stats;
    stats_total_hours = r.total_hours.toString();
    stats_total_hours_last_7d = r.total_hours_last_7d.toString();
    stats_classes_affected = r.classes_affected.toString();
    stats_schools_affected = r.schools_affected.toString();
  });

  let { data, form }: PageProps = $props();

  // Client-side guardrail: reuses FormHint's rules so the button and the hint
  // can never disagree. This only improves UX — the server action stays the real
  // validation boundary, since a disabled button is trivial to bypass.
  let canSubmit = $derived(
    canSubmitForm({
      selectedSchool,
      selectedClass,
      selectedDate: dateToStr(selectedDate),
    })
  );
</script>

<div class="mx-auto max-w-7xl px-4 py-8">
  <!-- Hero Section -->
  <section class="mb-6">
    <div class="bg-mybeige-bg rounded-lg p-8">
      <p class="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
        Moniteur national des absences en classe
      </p>
      <h1 class="text-foreground mb-4 text-5xl font-bold">
        Chaque classe manquée mérite d'être comptabilisée.
      </h1>
      <p class="text-muted-foreground text-lg">
        Les parents et les élèves peuvent enregistrer les absences des enseignants et contribuer à
        une image plus claire des apprentissages perdus dans votre communauté scolaire.
      </p>
    </div>
  </section>

  <!-- Main Content Grid -->
  <form method="POST" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
    <!-- Map Section (Left - 2 cols) -->
    <section class="lg:col-span-2">
      <CardReport
        bind:selectedDept
        bind:selectedClass
        bind:selectedSchool
        bind:selectedDate
        bind:nbHours
        {canSubmit}
      />
      <input type="hidden" name="nbHours" value={nbHours} />
      <input type="hidden" name="dept" value={selectedDept} />
      <input type="hidden" name="class" value={selectedClass} />
      <input type="hidden" name="schoolId" value={selectedSchool?.id} />
      <input type="hidden" name="school_name" value={selectedSchool?.name} />
      <input type="hidden" name="date" value={dateToStr(selectedDate)} />
    </section>
  </form>

  <!-- Statistics Preview Section -->
  <section class="mt-12">
    <Card.Root>
      <Card.Header>
        <Card.Title>Aperçu des statistiques</Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div class="rounded-lg bg-blue-50 p-4 text-center">
            <p class="text-3xl font-bold text-blue-600">{stats_total_hours}</p>
            <p class="text-sm text-gray-600">Total des heures manquées</p>
          </div>
          <div class="rounded-lg bg-green-50 p-4 text-center">
            <p class="text-3xl font-bold text-green-600">{stats_total_hours_last_7d}</p>
            <p class="text-sm text-gray-600">Heures rapportées la semaine dernière</p>
          </div>
          <div class="rounded-lg bg-yellow-50 p-4 text-center">
            <p class="text-3xl font-bold text-yellow-600">{stats_schools_affected}</p>
            <p class="text-sm text-gray-600">Écoles affectées</p>
          </div>
          <div class="rounded-lg bg-red-50 p-4 text-center">
            <p class="text-3xl font-bold text-red-600">{stats_classes_affected}</p>
            <p class="text-sm text-gray-600">Classes affectées</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </section>

  <!-- Recent reports-->
  <section class="mt-12">
    {#await data.missed_hours}
      <RecentReports missed_hours={[]} is_loading={true} />
    {:then mh}
      <RecentReports missed_hours={mh} is_loading={false} />
    {/await}
  </section>
</div>
