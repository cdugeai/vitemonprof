import type { FormHintProps } from '$lib/components/form_class/FormHint.svelte';

/**
 * The form's requirements, checked in the same top-to-bottom order as the
 * fields appear. Only the *first* unmet one is returned: showing every error
 * at once is noise when the user has barely started filling the form.
 *
 * Exported from `<script module>` so it runs once per module rather than once
 * per component instance, and so `+page.svelte` can reuse it to decide whether
 * the submit button is enabled. That shared use is the point — it makes this
 * the single source of truth, so the hint and the button can never disagree.
 *
 * Kept as a plain function (no runes) so it stays testable and callable from
 * anywhere, not just from reactive component context.
 */
export function firstMissingRequirement({
  selectedSchool,
  selectedClass,
  selectedDate,
}: FormHintProps): string | null {
  if (!selectedSchool) return 'Choisissez une école sur la carte pour continuer.';
  if (!selectedClass) return 'Sélectionnez une classe pour continuer.';
  if (!selectedDate) return 'Choisissez la date manquée pour continuer.';
  return null;
}

export function canSubmitForm({
  selectedSchool,
  selectedClass,
  selectedDate,
}: FormHintProps): boolean {
  return firstMissingRequirement({ selectedSchool, selectedClass, selectedDate }) === null;
}

/**
 * Today's date as `YYYY-MM-DD` — the only format `<input type="date">` accepts
 * for its value, regardless of how the browser displays it to the user.
 *
 * Deliberately *not* `new Date().toISOString().slice(0, 10)`, the usual
 * one-liner for this: `toISOString()` converts to UTC first, so anywhere east
 * of Greenwich (Paris is UTC+1/+2) every moment between local midnight and the
 * offset reports *yesterday*. Reading the local getters keeps us in the user's
 * own day.
 *
 * `date` is injectable so the behaviour is testable without faking the clock.
 */
export function todayLocalISO(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
