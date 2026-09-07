import type {
  MissedHour,
  MissedHourStats,
  NewMissedHour,
  TopMissedHours,
  TopDimension,
} from '$lib/types/missedHours';

/**
 * The storage port for missed-hour reports.
 *
 * This interface — not Drizzle — is the app's portability boundary. Drizzle looks
 * swappable but isn't: `pgTable` / `sqliteTable` / … are different APIs with
 * different types, so changing engine underneath it still rewrites the data layer.
 * Keeping the contract in domain terms (`MissedHour`, `MissedHourStats` — plain
 * strings and numbers, no driver types) means an engine swap touches exactly one
 * implementation file and nothing above it.
 *
 * The rule that keeps this honest: **no engine type may cross this boundary**. No
 * Drizzle row types, no `Date` objects out of the driver, no `numeric` strings.
 * The implementation maps to the domain shape; callers stay ignorant of storage.
 */
export interface MissedHourRepo {
  /**
   * Persist one report, and answer with the id the store assigned it.
   *
   * The argument is a `NewMissedHour`: the id is the store's to give, never the
   * caller's to mint. What comes back is that id, and it can only come back —
   * a sequence lives in the database, so a caller has no way to know it
   * otherwise, and asking a second time (`max(id)`, `currval()`) would answer
   * about someone else's report under concurrent submissions.
   *
   * The one caller that wants it is the log line in the submission action:
   * naming the row makes an accepted report traceable from an access log to a
   * table. Backends therefore have to read it out of the write, which is why
   * `insertMissedHour` carries a `returning` clause.
   */
  add(mh: NewMissedHour): Promise<number>;

  /**
   * All reports, **newest first** (`createdAt` descending).
   *
   * The order is part of the contract, not an accident of the implementation:
   * `RecentReports.svelte` labels them "récents", so an insertion-ordered result
   * would show the oldest reports.
   *
   * @param limit Optional upper bound on the number of rows returned. If undefined,
   *              no limit is applied.
   */
  list(limit?: number): Promise<MissedHour[]>;

  /**
   * Aggregates for the stats panel.
   *
   * Separate from `list()` on purpose: this is the one operation that should be
   * pushed down into the engine rather than computed after fetching every row.
   * Each backend is free to implement it its own way — that divergence is the
   * point of the interface, not a leak in it.
   */
  stats(): Promise<MissedHourStats>;

  /**
   * The `limit` schools — or disciplines — with the most missed hours, ranked by
   * total hours descending.
   *
   * `departement: null` means the whole country. Rows whose grouping value is
   * null are excluded: a "Non précisé" entry would top the discipline ranking on
   * a young dataset while naming no subject at all, which is noise where the
   * page's whole job is to name things.
   *
   * Ranked by hours rather than by number of reports, because hours is the
   * quantity the site is about — and because report count is the easier number
   * to inflate. Ties break on the key so a page reload cannot reshuffle two
   * equal rows.
   */
  top(options: TopQuery): Promise<TopMissedHours[]>;
}

/** The arguments to `MissedHourRepo.top`. */
export interface TopQuery {
  /** Restrict to one département, or `null` for the whole country. */
  departement: string | null;
  dimension: TopDimension;
  limit: number;
}

/** What the dashboard asks for when nothing says otherwise. */
export const TOP_LIMIT = 5;

/** Rolling window for the "last 7 days" stat, shared so backends can't disagree. */
export const STATS_WINDOW_DAYS = 7;

/**
 * What makes two reports descriptions of *the same missed hour*.
 *
 * A missed hour is one specific hour: **this class and group, at this school, on
 * this day, in this subject, for this many hours**. `corroborations` counts how
 * many reports land on that key. Every descriptive field the reporter fills in
 * is part of it — the key is the whole report, minus the two fields the reporter
 * does not choose (`createdAt`, and `departement`, which is derived from the
 * school).
 *
 * The key is deliberately exact. A looser one would merge things that are not
 * the same hour and report them as corroborating each other: school + class +
 * date alone puts a maths hour and a sport hour on one morning in the same
 * bucket, and leaving `classGroup` out does the same to « 6e A » and « 6e B »,
 * which are different rooms of different pupils. Corroboration is the app's only
 * evidence that an anonymous report is real, so overstating it is the expensive
 * direction to be wrong in.
 *
 * The cost is that agreement now has to be total, and it is a high bar for
 * anonymous reporters. Two people describing one cancelled hour who differ on
 * the subject, the duration, or the group produce two events of one report each.
 * A `null` is its own value throughout: two reports that both left the group
 * blank corroborate, a blank one and a filled one do not — and both fields are
 * optional on the form, which makes that the most common way a count stays at 1.
 * The number understates agreement rather than inflating it.
 *
 * **This is now the same set of fields as `reportFingerprint` in
 * `$lib/server/rateLimit`,** which refuses the exact same report twice from one
 * IP inside two minutes. The two are independent by design and answer different
 * questions — "is this the same hour?" against "is this a resubmission?" — but
 * while they coincide, a corroboration cannot come from one address in that
 * window. That is the intended reading of the badge: several *people*, not
 * several clicks.
 *
 * Domain spelling here; `missedHourQueries.ts` holds the column spelling. The
 * conformance suite is what keeps the two honest, by asserting the same counts
 * against every backend.
 */
export const CORROBORATION_KEY = [
  'schoolId',
  'class',
  'classGroup',
  'date_',
  'discipline',
  'nbHours',
] as const satisfies readonly (keyof NewMissedHour)[];
