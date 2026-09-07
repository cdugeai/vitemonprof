<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import type { School } from '$lib/types/school';
  import RecentReports from '$lib/components/RecentReports.svelte';
  import type { PageProps } from './$types';
  import { canSubmitForm } from '$lib/utils_form';
  import { enhance } from '$app/forms';
  import CardReport from '$lib/components/form_class/CardReport.svelte';
  import { CalendarDate } from '@internationalized/date';
  import { dateToStr } from '$lib/utils';
  import * as Alert from '$lib/components/ui/alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { page } from '$app/state';

  let selectedClass: string | undefined = $state();
  let selectedSchool: School | undefined = $state();
  let selectedDate: CalendarDate | undefined = $state();
  let selectedDept: string | undefined = $state();
  let nbHours: number = $state(1);

  let { data, form }: PageProps = $props();

  // True from the moment the form is submitted until the redirect has been followed and
  // the page data re-fetched. Guards against the double-submit you'd otherwise get by
  // tapping "Envoyer" twice while the request is in flight.
  let submitting = $state(false);

  // The action redirects to `/?submitted`, so the URL is what carries the confirmation
  // across the redirect — it survives with or without JS, unlike the `form` prop, which a
  // redirect discards.
  //
  // Seeded into `$state` rather than `$derived` straight off the URL because the flag has
  // to be *dismissable*: a failed re-submit leaves the URL untouched, so a derived flag
  // would leave "Rapport enregistré" sitting next to the new error. The `use:enhance`
  // callback clears it when a fresh attempt starts.
  let showSuccess = $state(false);

  $effect(() => {
    if (page.url.searchParams.has('submitted')) showSuccess = true;
  });

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

<div class="mx-auto max-w-7xl px-4 py-8 md:px-8">
  <!-- Hero Section -->
  <section class="mb-6">
    <div class="bg-mybeige-bg rounded-lg">
      <p class="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
        Moniteur national des absences en classe
      </p>
      <h1 class="text-foreground mb-4 text-5xl font-bold md:text-5xl">
        Le suivi des abscences non remplacées.
      </h1>
      <p class="text-muted-foreground text-lg">
        Les parents et les élèves peuvent enregistrer les absences des enseignants et contribuer à
        une image plus claire des apprentissages perdus dans votre communauté scolaire.
      </p>
    </div>
  </section>

  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
    <!-- Form Section (Left) -->
    <!--
      `use:enhance` intercepts the submit and sends it with fetch instead of navigating, so
      no POST ever lands in the browser's history. The server's 303 is still what makes a
      hard refresh safe for anyone without JS — the two fixes cover different paths.
      `update()` applies the result: for a redirect it navigates and re-runs `load`, which
      is what refreshes the stats and the "rapports récents" list below.
    -->
    <form
      method="POST"
      use:enhance={() => {
        submitting = true;
        showSuccess = false; // a new attempt retires the previous confirmation
        return async ({ update }) => {
          await update();
          submitting = false;
        };
      }}
    >
      <CardReport
        bind:selectedDept
        bind:selectedClass
        bind:selectedSchool
        bind:selectedDate
        bind:nbHours
        {canSubmit}
        {submitting}
      />
      <!--
        `Alert.Root` already renders `role="alert"`, so screen readers announce these the
        moment they appear — no extra ARIA needed. The success case has no `variant` of its
        own in shadcn-svelte (only `default` and `destructive`), so it borrows the app's
        green via utility classes rather than a new variant.
      -->
      {#if showSuccess}
        <Alert.Root class="mt-4 border-green-600/30 bg-green-50 text-green-900">
          <CircleCheck class="text-green-600" />
          <Alert.Title>Rapport enregistré</Alert.Title>
          <Alert.Description class="text-green-800">
            Merci ! Votre signalement a bien été pris en compte et apparaît maintenant dans les
            rapports récents.
          </Alert.Description>
        </Alert.Root>
      {/if}

      {#if form?.error}
        <Alert.Root variant="destructive" class="mt-4">
          <CircleAlert />
          <Alert.Title>Le rapport n'a pas pu être envoyé</Alert.Title>
          <Alert.Description>{form.error}</Alert.Description>
        </Alert.Root>
      {/if}
      <input type="hidden" name="nbHours" value={nbHours} />
      <input type="hidden" name="dept" value={selectedDept} />
      <input type="hidden" name="class" value={selectedClass} />
      <input type="hidden" name="schoolId" value={selectedSchool?.id} />
      <input type="hidden" name="school_name" value={selectedSchool?.name} />
      <input type="hidden" name="date" value={dateToStr(selectedDate)} />
    </form>

    <!-- Statistics Preview Section (Right) -->
    <section>
      <Card.Root>
        <Card.Header>
          <Card.Title>Aperçu des statistiques</Card.Title>
        </Card.Header>
        <Card.Content>
          <!--
            Awaited in the template rather than in `onMount`: `data.missed_hours_stats` is a
            streamed promise, and a new one arrives every time `load` re-runs. An `onMount`
            only ever reads the first one, so the numbers would go stale after a submit.
          -->
          {#await data.missed_hours_stats}
            {@render stats('-', '-', '-', '-')}
          {:then s}
            {@render stats(
              s.total_hours.toString(),
              s.total_hours_last_7d.toString(),
              s.schools_affected.toString(),
              s.classes_affected.toString()
            )}
          {/await}
        </Card.Content>
      </Card.Root>
    </section>
  </div>

  <!-- Recent reports-->
  <section class="mt-12">
    {#await data.missed_hours}
      <RecentReports missed_hours={[]} is_loading={true} />
    {:then mh}
      <RecentReports missed_hours={mh} is_loading={false} />
    {/await}
  </section>
</div>

{#snippet stats(total: string, last7d: string, schools: string, classes: string)}
  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    <div class="rounded-lg bg-blue-50 p-4 text-center">
      <p class="text-3xl font-bold text-blue-600">{total}</p>
      <p class="text-sm text-gray-600">Total des heures manquées</p>
    </div>
    <div class="rounded-lg bg-green-50 p-4 text-center">
      <p class="text-3xl font-bold text-green-600">{last7d}</p>
      <p class="text-sm text-gray-600">Heures rapportées la semaine dernière</p>
    </div>
    <div class="rounded-lg bg-yellow-50 p-4 text-center">
      <p class="text-3xl font-bold text-yellow-600">{schools}</p>
      <p class="text-sm text-gray-600">Écoles affectées</p>
    </div>
    <div class="rounded-lg bg-red-50 p-4 text-center">
      <p class="text-3xl font-bold text-red-600">{classes}</p>
      <p class="text-sm text-gray-600">Classes affectées</p>
    </div>
  </div>
{/snippet}
