<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import Seo from '$lib/components/Seo.svelte';
  import type { School } from '$lib/types/school';
  import RecentReports from '$lib/components/RecentReports.svelte';
  import type { PageProps, SubmitFunction } from './$types';
  import { canSubmitForm } from '$lib/utils_form';
  import { applyAction, enhance } from '$app/forms';
  import CardReport from '$lib/components/form_class/CardReport.svelte';
  import { CalendarDate } from '@internationalized/date';
  import { dateToISO, dateToStr } from '$lib/utils';
  import * as Alert from '$lib/components/ui/alert';
  import CircleCheck from '@lucide/svelte/icons/circle-check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import type { ClassGroup } from '$lib/classGroups';
  import type { ClassLevel } from '$lib/classLevels';
  import type { Discipline } from '$lib/disciplines';

  let selectedClass: ClassLevel | undefined = $state();
  let selectedClassGroup: ClassGroup | undefined = $state();
  let selectedDiscipline: Discipline | undefined = $state();
  let selectedSchool: School | undefined = $state();
  let selectedDate: CalendarDate | undefined = $state();
  let nbHours: number = $state(1);

  let { data, form }: PageProps = $props();

  // True from the moment the form is submitted until the result has been applied and the
  // page data re-fetched. Guards against the double-submit you'd otherwise get by tapping
  // "Envoyer" twice while the request is in flight.
  let submitting = $state(false);

  // `?submitted` is the confirmation for browsers that follow the action's 303 for real —
  // that is, browsers without JS. `use:enhance` recognises the success itself and never
  // follows the redirect, so with JS this is always false and the toast is what confirms.
  let noJsConfirmation = $derived(page.url.searchParams.has('submitted'));

  // Pulled out of the template and typed with the generated `SubmitFunction`: that is
  // what makes `result.data.error` a `string` rather than `unknown`, because the failure
  // shape is inferred from the action's own `fail()` calls.
  const handleSubmit: SubmitFunction = () => {
    submitting = true;
    return async ({ result, update }) => {
      if (result.type === 'redirect') {
        // The 303 *is* the success signal, so the toast comes straight off the result
        // — no flag round-tripping through the URL. And we deliberately don't follow
        // the redirect: `use:enhance` sent this with fetch, so there is no POST
        // history entry for Post/Redirect/Get to repair, and following it would drag
        // `?submitted` into the address bar for no reason. All the redirect was
        // buying us here is a fresh `load`, which `invalidateAll` does on its own.
        toast.success("Merci, c'est enregistré", {
          // Terser than the alert below: a toast is read in passing, and the list it
          // points at is right there on the page.
          description: 'Votre soumission apparaît dès maintenant dans les soumissions récentes.',
        });
        // Retires a failure left over from a submit made *before* hydration, which is
        // the one way `form` can be set while JS is running. `form` only resets on
        // navigation, and not navigating is the whole point above — without this, the
        // red alert would sit there under a green toast saying the opposite.
        await applyAction({ type: 'success', status: 200, data: undefined });
        await invalidateAll();
      } else if (result.type === 'failure') {
        // Same shape as the success case: the result carries the message, so nothing
        // has to be applied to the page to display it. Not calling `update()` here is
        // deliberate — it would set the `form` prop, and the alert below would then
        // say the same thing a second time, in a second place.
        toast.error("La soumission n'a pas pu être envoyée", {
          description: result.data?.error ?? 'Merci de réessayer dans un instant.',
          // Longer than the success toast: this one asks the reader to do something
          // about it, and "vous avez déjà effectué cette soumission" takes two lines.
          duration: 8000,
        });
      } else {
        // `type: 'error'` — the action threw. Only `update()` knows how to put the
        // nearest +error.svelte on screen, and a toast would be the wrong shape for it
        // anyway: the page is no longer trustworthy, so it has to be replaced.
        await update();
      }
      submitting = false;
    };
  };

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

<Seo title="Le suivi des absences de courte durée" />

<div class="mx-auto max-w-7xl px-4 py-8 md:px-8">
  <!-- Hero Section -->
  <section class="mb-6">
    <div class="bg-mybeige-bg rounded-lg">
      <p class="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
        Observatoire participatif
      </p>
      <h1 class="text-foreground mb-4 text-5xl font-bold md:text-5xl">
        Le suivi des absences de courte durée.
      </h1>
      <p class="text-muted-foreground text-lg">
        La comptabilisation des absences de courte durée non remplacées est une donnée difficile à
        obtenir et consolider au niveau national. ViteMonProf rassemble les soumissions des
        familles, élèves et personnels pour en donner une vue d'ensemble — dans votre établissement,
        votre département et partout en France.
      </p>
    </div>
  </section>

  <!--
    Two columns on desktop, one stack on mobile. The right column is a plain flex
    stack rather than two grid items, so the source order — form, chiffres,
    récents — stays the reading order on mobile, where the grid collapses to one
    column and every `md:` rule below switches off.
  -->
  <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
    <!-- Form Section (Left) -->
    <!--
      `use:enhance` intercepts the submit and sends it with fetch instead of navigating, so
      no POST ever lands in the browser's history. The server's 303 is still what makes a
      hard refresh safe for anyone without JS — the two fixes cover different paths, and
      `handleSubmit` above is where the enhanced one is spelled out.
    -->
    <form method="POST" use:enhance={handleSubmit}>
      <CardReport
        bind:selectedClass
        bind:selectedClassGroup
        bind:selectedDiscipline
        bind:selectedSchool
        bind:selectedDate
        bind:nbHours
        {canSubmit}
        {submitting}
      />
      <!--
        The no-JS confirmation. Sonner needs JS, so without it the toast never fires and
        the redirect would land on a page that looks unchanged. Only a browser that
        followed the 303 for real ever has `?submitted` in its URL, so this and the toast
        can't both appear: one confirmation either way, never two.

        `Alert.Root` already renders `role="alert"`, so screen readers announce these the
        moment they appear — no extra ARIA needed. The success case has no `variant` of its
        own in shadcn-svelte (only `default` and `destructive`), so it borrows the app's
        green via utility classes rather than a new variant.
      -->
      {#if noJsConfirmation}
        <Alert.Root class="mt-4 border-green-600/30 bg-green-50 text-green-900">
          <CircleCheck class="text-green-600" />
          <Alert.Title>Merci, c'est enregistré</Alert.Title>
          <Alert.Description class="text-green-800">
            Votre soumission rejoint celles des autres contributeurs et apparaît dès maintenant dans
            les soumissions récentes.
          </Alert.Description>
        </Alert.Root>
      {/if}

      <!--
        The other half of the no-JS story. `form` is set by the server when it renders a
        rejected submission, and by nothing else here: the enhanced path answers a failure
        with a toast and deliberately skips `update()`. So this is what a browser without
        JS sees — and what a browser *with* JS sees for the one submit that can beat
        hydration to the punch.
      -->
      {#if form?.error}
        <Alert.Root variant="destructive" class="mt-4">
          <CircleAlert />
          <Alert.Title>La soumission n'a pas pu être envoyée</Alert.Title>
          <Alert.Description>{form.error}</Alert.Description>
        </Alert.Root>
      {/if}
      <input type="hidden" name="nbHours" value={nbHours} />
      <input type="hidden" name="class" value={selectedClass} />
      <input type="hidden" name="classGroup" value={selectedClassGroup ?? ''} />
      <input type="hidden" name="discipline" value={selectedDiscipline ?? ''} />
      <input type="hidden" name="schoolId" value={selectedSchool?.id} />
      <input type="hidden" name="school_name" value={selectedSchool?.name} />
      <input type="hidden" name="date" value={dateToISO(selectedDate)} />
    </form>

    <!--
      Right column: the two read-only panels, stacked and clamped to the form.

      The empty `md:relative` wrapper is what makes the columns end level. A grid
      row is as tall as its tallest item, so a right column that simply stacked
      both cards would be the thing *deciding* the row height — and there is then
      no non-circular way to tell it to be shorter than itself.

      `md:absolute` takes the stack out of flow, so the wrapper measures as zero
      and the form sizes the row alone; `md:inset-0` then stretches the stack back
      over exactly that height. The constraint arrives from outside, which is what
      breaks the loop.

      All of it is behind `md:`, so mobile keeps a static, naturally-sized stack
      with no scroll container and no absolute positioning.
    -->
    <div class="md:relative">
      <div class="flex flex-col gap-8 md:absolute md:inset-0">
        <!-- Statistics Preview -->
        <section class="shrink-0">
          <Card.Root>
            <Card.Header>
              <Card.Title>Ce que disent les soumissions</Card.Title>
              <Card.Description>
                Une heure soumise par plusieurs personnes n'est comptée qu'une fois.
              </Card.Description>
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

        <!--
          `md:min-h-0` for the same reason it appears inside `RecentReports`: without
          it this flex item will not shrink below its content, and the card would
          overflow the clamped column instead of scrolling inside it.
        -->
        <section class="md:min-h-0 md:flex-1">
          {#await data.missed_hours}
            <RecentReports missed_hours={[]} is_loading={true} class="md:h-full" />
          {:then mh}
            <RecentReports missed_hours={mh} is_loading={false} class="md:h-full" />
          {/await}
        </section>
      </div>
    </div>
  </div>
</div>

{#snippet stats(total: string, last7d: string, schools: string, classes: string)}
  <div class="grid grid-cols-2 gap-4">
    <div class="rounded-lg bg-blue-50 p-4 text-center">
      <p class="text-3xl font-bold text-blue-600">{total}</p>
      <p class="text-sm text-gray-600">Heures non remplacées</p>
    </div>
    <div class="rounded-lg bg-green-50 p-4 text-center">
      <p class="text-3xl font-bold text-green-600">{last7d}</p>
      <p class="text-sm text-gray-600">Soumises ces 7 derniers jours</p>
    </div>
    <div class="rounded-lg bg-yellow-50 p-4 text-center">
      <p class="text-3xl font-bold text-yellow-600">{schools}</p>
      <p class="text-sm text-gray-600">Établissements concernés</p>
    </div>
    <div class="rounded-lg bg-red-50 p-4 text-center">
      <p class="text-3xl font-bold text-red-600">{classes}</p>
      <p class="text-sm text-gray-600">Classes concernées</p>
    </div>
  </div>
{/snippet}
