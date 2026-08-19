import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { School } from './types/school';
import { getLocalTimeZone, type CalendarDate } from '@internationalized/date';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export const buildLabelSchool = (s: School) => `${s.name} (${s.postalCode} ${s.city})`;

/** Human-readable date, for **display only** — the format follows the user's locale. */
export const dateToStr = (date_: CalendarDate | undefined) =>
  date_ ? date_.toDate(getLocalTimeZone()).toLocaleDateString() : '';

/**
 * `YYYY-MM-DD`, for anything that leaves the browser — form values, APIs, storage.
 *
 * Kept strictly separate from `dateToStr`: sending a locale-formatted date over the
 * wire is a bug waiting to happen, because `05/08/2026` means August 5th in Paris
 * and May 8th in New York, and the server has no way to tell which was meant.
 * `CalendarDate.toString()` is already ISO and, being a plain calendar date with no
 * time zone, needs no conversion to get there.
 */
export const dateToISO = (date_: CalendarDate | undefined) => date_?.toString() ?? '';

/**
 * Lowercase and strip diacritics, so « Vitré » and « VITRE » are the same needle —
 * and so a French search box doesn't demand that people type their accents.
 *
 * NFD splits « é » into `e` + a combining accent; the regex then drops the accent
 * and keeps the letter. Every search in the app normalises *both* sides with this
 * one function, which is the only way the school list and the discipline list can
 * be guaranteed to agree on what "matches" means.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
