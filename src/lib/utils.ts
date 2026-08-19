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
