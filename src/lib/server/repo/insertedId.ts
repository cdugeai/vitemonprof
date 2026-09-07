/**
 * The id an `insert … returning "id"` handed back, as the domain's `number`.
 *
 * Shared by both SQL backends because the value has to be *identical* across
 * them — the conformance suite asserts that the id `add()` returns is the id
 * `list()` then reports — while the drivers disagree on what they hand over:
 * postgres-js returns a JS number for an `integer` column, DuckDB a `bigint`.
 * `Number` covers both, and a sequence exhausts `integer` long before it
 * threatens `Number.MAX_SAFE_INTEGER`.
 *
 * The missing-row branch throws rather than falling back to `0`, which is the
 * opposite of what `stats()` does a few files over — and for a reason. There, 0
 * is the *true* answer over an empty table, so the fallback is honest. There is
 * no honest fallback for an id: 0 names a row that does not exist, and its only
 * consumer is a log line whose whole job is to be traceable back to the table.
 * A single-row `insert … returning` yields exactly one row in both engines or
 * has already thrown, so this is unreachable — it is here so that the day it
 * stops being unreachable, it says so.
 */
export function insertedId(value: unknown): number {
  if (value === null || value === undefined) {
    throw new Error('missed_hour insert returned no id');
  }

  return Number(value);
}
