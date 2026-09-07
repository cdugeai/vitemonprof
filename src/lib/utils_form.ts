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
  if (!selectedSchool) return 'Pick a school on the map to continue.';
  if (selectedClass === 'none') return 'Select a class to continue.';
  if (!selectedDate) return 'Choose the date missed to continue.';
  return null;
}

export function canSubmitForm({
  selectedSchool,
  selectedClass,
  selectedDate,
}: FormHintProps): boolean {
  return firstMissingRequirement({ selectedSchool, selectedClass, selectedDate }) === null;
}
