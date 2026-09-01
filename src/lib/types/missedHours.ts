import type { ClassGroup } from '$lib/classGroups';
import type { Discipline } from '$lib/disciplines';

/**
 * A stored report, with the id the database gave it.
 *
 * `id` is an `integer` from a sequence, not a UUID: see
 * `migrations/003_missed_hour_serial_id.ts`. The practical consequence for
 * everything above this file is that ids are **assigned by the store, on write** —
 * so a report that has not been persisted yet does not have one, which is what
 * `NewMissedHour` is for.
 */
export interface MissedHour extends NewMissedHour {
  id: number;

  /**
   * How many reports — this one included — name the same missed hour.
   *
   * `1` means nobody else reported it; `3` means three people independently
   * described the same class losing the same day. Since every reporter here is
   * anonymous and unverified, agreement between them is the only evidence the
   * app has that a report is real, which is why the number is worth surfacing
   * rather than leaving implicit in the row count.
   *
   * **Computed on read, never stored.** There is no `corroborations` column: it
   * is a `count(*) over (partition by …)` in `list()`, and the memory backend
   * counts the same key in JS. Storing it would mean every insert had to update
   * the sibling rows it corroborates, which is a write amplification and a
   * consistency risk in exchange for an aggregate the database computes for
   * free.
   */
  corroborations: number;
}

/**
 * A report on its way in — everything except the id.
 *
 * Splitting the type is what makes "the store assigns the id" a rule the compiler
 * enforces rather than a comment. With a single `MissedHour` the caller would
 * have to invent an id it has no business inventing (`0`? `-1`?) just to satisfy
 * the shape, and nothing would stop that placeholder being read back later.
 */
export interface NewMissedHour {
  schoolId: string;
  class: string;
  classGroup: ClassGroup | null;
  /** Subject of the missed class, or `null` when the reporter did not say. */
  discipline: Discipline | null;
  date_: string;
  nbHours: number;
  createdAt: string;

  /**
   * The département the school sits in (`'75'`, `'2A'`, `'974'`), resolved from
   * the registry at write time.
   *
   * Denormalised on purpose — schools live in a CSV the database knows nothing
   * about, so without this column no département-scoped query could be pushed
   * down into the engine. See `migrations/006_missed_hour_departement.ts`.
   *
   * `null` for a report whose school is not in the registry, and for every row
   * written before that migration until `scripts/backfill-departement.ts` has
   * run. Nulls are excluded from département-scoped rankings rather than being
   * bucketed somewhere plausible.
   */
  departement: string | null;
}

export interface MissedHourStats {
  total_hours: number;
  total_hours_last_7d: number;
  schools_affected: number;
  classes_affected: number;
}

/** What a ranking groups by: schools, or the subjects that went untaught. */
export type TopDimension = 'school' | 'discipline';

/** One row of a ranking — see `MissedHourRepo.top`. */
export interface TopMissedHours {
  /**
   * The grouped value: a school's UAI code when the dimension is `school`, a
   * discipline id when it is `discipline`.
   *
   * Deliberately an opaque id, not a label. Schools are named by the CSV
   * registry and disciplines by `$lib/disciplines`, neither of which the storage
   * layer has any business knowing about — so the rendering happens where the
   * labels live.
   */
  key: string;
  totalHours: number;
  reportCount: number;
}
