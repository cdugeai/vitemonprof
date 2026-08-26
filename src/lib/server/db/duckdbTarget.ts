/**
 * `DUCKDB_PATH` carries two very different databases behind one string: a
 * filesystem path, which DuckDB opens in-process under an OS-level write lock,
 * and an `md:` URL, which is MotherDuck — a shared network service.
 *
 * Nothing in the app branches on the difference; it runs the same SQL either way.
 * These two exist for the places that genuinely cannot avoid knowing: logging,
 * which must not leak the token, and the `checkpoint` in `scripts/migrate.ts`,
 * which flushes a WAL that only a local file has.
 *
 * Kept free of `$env` and of the driver so the plain-Node migration script can
 * import it as easily as the app can.
 */
export function isMotherDuck(path: string): boolean {
  return path.trim().toLowerCase().startsWith('md:');
}

/**
 * An `md:` URL may carry the token as a query parameter
 * (`md:vitemonprof?motherduck_token=...`). Log this, never the raw value.
 */
export function describeDuckDbTarget(path: string): string {
  const trimmed = path.trim();

  return isMotherDuck(trimmed) ? `motherduck (${trimmed.split('?')[0]})` : `file (${trimmed})`;
}
