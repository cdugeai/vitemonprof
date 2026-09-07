# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working style

The author is learning SvelteKit. Prioritize **production-quality, idiomatic code** over shortcuts, and **explain the best practices as you go** — why a pattern is preferred, what the alternatives are, and any tradeoffs. Favor teaching moments over just producing output.

## Commands

- `npm run dev` — start the Vite dev server (`-- --open` to open a browser)
- `npm run build` — production build; `npm run preview` to serve it locally
- `npm run check` — type-check Svelte + TypeScript (runs `svelte-kit sync` first)
- `npm run lint` — Prettier check + ESLint
- `npm run format` — auto-format with Prettier

### Tests

- `npm test` — everything: Vitest (unit + repo contract) then Playwright (E2E)
- `npm run test:unit` — Vitest in watch mode; add `-- --run` for a single pass
- `npm run test:e2e` — Playwright only

Running one test:

- `npm run test:unit -- --run src/lib/disciplines.spec.ts` — one file
- `npm run test:unit -- --run -t "ignores accents"` — one test by name
- `npm run test:e2e -- e2e/report.spec.ts` — one E2E file
- `npm run test:e2e -- --ui` — Playwright's interactive runner

Layout and conventions:

- `src/**/*.spec.ts` — Vitest, node environment (see the `server` project in `vite.config.ts`). `expect.requireAssertions` is on, so every test must assert something.
- `src/lib/server/repo/repo.conformance.spec.ts` — one contract suite replayed against **every** `MissedHourRepo` implementation via `describe.each`. Add a backend to the `BACKENDS` array and it inherits the whole suite. DuckDB runs in `:memory:` against the real `SCHEMA_DDL`, so no service is needed; Postgres is deliberately excluded because it would make `npm test` depend on Docker.
- `e2e/` — Playwright. `playwright.config.ts` starts its own dev server on port 4173 with `MISSED_HOUR_REPO=memory`, so E2E never touches a real database regardless of what `.env` says.

## Architecture

SvelteKit app (adapter-auto) using **Svelte 5** with **runes mode forced on** for all first-party code via `vite.config.ts` (only `node_modules` are exempt). Write components with runes (`$props`, `$state`, `$derived`, etc.), not the legacy Svelte 4 API.

- `src/routes/` — filesystem-based routing. `+layout.svelte` / `+page.svelte` for UI; `+page.ts`/`+page.server.ts` for loaders (none yet).
- `src/lib/` — importable via the `$lib` alias; shared code and assets live here.
- `src/app.html` — HTML shell; `src/app.d.ts` — ambient/app-level types.

The project is a fresh minimal scaffold (`sv create --template minimal`) — `src/routes/+page.svelte` is still the starter page. Beyond the tooling and runes-mode constraint above, there is no application architecture established yet.

## UI: Tailwind + shadcn-svelte

Styling is **Tailwind CSS v4** (via `@tailwindcss/vite`) plus **shadcn-svelte** for components. Use these for all UI work going forward:

- Style with Tailwind utility classes. Avoid component-scoped `<style>` blocks for anything utilities already cover.
- `src/app.css` is the Tailwind entry point (`@import 'tailwindcss'`) plus shadcn-svelte's theme tokens (OKLCH color vars, `@theme inline` mappings, dark mode via `.dark`). Add new design tokens there, not inline styles.
- For any non-trivial UI primitive (button, dialog, dropdown, card, input, etc.), check whether shadcn-svelte already has it before hand-rolling one: `npx shadcn-svelte@latest add <component>`. This installs the component's source into `src/lib/components/ui/<component>` (per `components.json`) so it's yours to edit directly.
- `components.json` config: style `vega`, base color `neutral`, icons via `lucide` (`@lucide/svelte`), aliases `$lib/components`, `$lib/components/ui`, `$lib/utils`, `$lib/hooks`.
- Use the `cn()` helper from `src/lib/utils.ts` (clsx + tailwind-merge) when a component needs to merge/override incoming `class` props — this is the standard shadcn-svelte pattern.

## `/api/schools` speaks gzipped JSON

The endpoint answers with **gzip bytes typed `application/gzip`**, not JSON — the
full registry is ~11.1 MB of JSON and ~2.5 MB gzipped. Coordinates are rounded to
5 decimals (~1 m) on the way out, which alone is worth ~750 kB gzipped: the CSV's
15-digit floats are noise that no compressor can squeeze. Compression is done with
[pako](https://www.npmjs.com/package/pako) at both ends:

- `$lib/server/gzip-json` — `gzipJson(value)` (bytes) and `gzipJsonResponse(bytes)`
- `$lib/gzip-json` — `fetchGzipJson<T>(url, init)`, the drop-in replacement for
  `fetch(url).then((r) => r.json())`. Never call `res.json()` on this endpoint.

Two things are deliberate:

- **`Content-Type`, not `Content-Encoding`.** Naming gzip as a transfer encoding
  makes the browser and every proxy inflate the body before our code sees it, so
  `pako.ungzip` would be handed plain JSON and throw. What we inflate ourselves is
  content, not encoding.
- **The all-schools buffer is cached compressed** in `+server.ts`. It's identical
  for every caller, and gzipping it costs ~380 ms — 3 ms once cached.

Split into two modules so the client chunk only tree-shakes in pako's inflate half.
pako 3 renamed the decode option: it is `{ toText: true }`, and the old
`{ to: 'string' }` is now ignored silently (you get a `Uint8Array` back).

## What a submission answers

`POST /` returns a status that says what happened to the report, and it takes a
hook to do it — `handleActionStatus` in `hooks.server.ts`, fed by
`locals.actionStatus`, which the action sets next to each `fail()`.

| outcome                | enhanced (`use:enhance`) | no JS |
| ---------------------- | ------------------------ | ----- |
| accepted               | `201`                    | `303` |
| invalid field          | `400`                    | `400` |
| throttled or duplicate | `429`                    | `429` |

Left to itself SvelteKit answers 200 to all six, for two unrelated reasons:

- **The enhanced path is 200 by design.** `use:enhance` asks for
  `application/json`, and SvelteKit replies with a 200 whose _body_ is the
  outcome (`{"type":"redirect","status":303}` or `{"type":"failure","status":400}`).
  `deserialize()` in `$app/forms` reads the body and ignores the status, which is
  what makes the outer one safe to overwrite.
- **A streamed page loses the failure's status.** `load` returns un-awaited
  promises, so the HTML is chunked, and SvelteKit's `render_response()` passes
  `status` only on the non-streamed branch — the 400 never reaches the wire.

The hook overwrites a 200 and nothing else. That is what leaves the no-JS `303`
alone: Post/Redirect/Get needs a redirect the browser actually follows, so
"accepted" has two codes and they say which kind of client reported.
`e2e/submission-status.spec.ts` pins all six.

## Page metadata lives in one component

Every page renders exactly one `<Seo />` (`src/lib/components/Seo.svelte`) instead
of hand-writing `<svelte:head>`. Defaults — site name, description, the Open Graph
image and its dimensions — are in `src/lib/seo.ts`; a page passes only its own
`title`, an optional `description`, and `noindex` where it applies.

One component rather than tags in `+layout.svelte`, because **Svelte does not dedupe
`<svelte:head>`**: a default `og:title` in the layout plus a real one on the page
emits both, and which one a crawler believes is anyone's guess.

Two things the tags depend on:

- **The URLs are absolute, built from `page.url`.** Open Graph resolves nothing
  relative — a bare `/og-image.jpg` is dropped and the card renders imageless.
  Deriving the origin from the request rather than hardcoding a domain is what
  makes dev, preview and production all correct with no env var to keep in sync.
  `og:url` and the canonical drop query and hash, so `?submitted=1` does not split
  the signal.
- **The image is in `static/`, not imported through Vite.** An imported asset gets
  a content hash in its URL, and social crawlers cache hard by URL; a stable path
  means a preview already scraped keeps working across deploys. It is 1200×630 —
  the 1.91:1 that Facebook, LinkedIn and X render without re-cropping — and the
  dimensions are declared as tags so the _first_ scrape lays out a large card
  instead of falling back to the small square one.

`e2e/seo.spec.ts` asserts all of it against the **served HTML**, not the DOM. A
crawler never runs JavaScript, so a tag that only appears after hydration is a tag
nobody sees — and a DOM-reading assertion would pass on it anyway. It also reads
the JPEG's real dimensions back out of the response, because the file can be
replaced without anyone touching `seo.ts`.

## Maplibre GL

Use examples on https://svelte-maplibre-gl.mierune.dev/examples to help get good quality code for the mapping part.

## The schools dataset

`data/…-premier-et-second-degre.csv` is the national school registry (~27 MB,
63k rows). It is **gitignored** and fetched by `scripts/fetch-schools.ts`:

- `npm run data:schools` — download it if missing
- `npm run data:schools -- --force` — refresh it (the dataset changes upstream)

`predev` and `prebuild` run it automatically, so `npm run dev`, `npm run build`
and Playwright (whose `webServer` is `npm run dev`) all just work on a fresh
clone.

## The CSV exports cover yesterday

`npm run db:export:hours` and `npm run db:export:events` each dump **one day** —
the day before the run — and name the file after it: run on the 15th, you get
`exports/missed-hour-20260914.csv`. They are a daily job, so each file is the
slice that appeared since the last one; the files concatenate into the table
rather than each restating it.

**`-- --day 2026-09-06` exports a named day instead** — for backfilling a run
that was missed, or for checking one. The day is a _flag_ because the optional
output path was already a bare argument, and confusing the two fails silently:
`-- exports/missed-hour-20260906.csv` renames the file without moving the
window, handing you the 5th's rows under the 6th's name.

The day is **UTC**, for the reason `MAX_FUTURE_DAYS` in `$lib/reportDate` gives:
French territory spans UTC-10 to UTC+12, so no local midnight is local for
everyone the site covers — and a UTC boundary makes a scheduled runner and a
laptop in Paris produce the same file. Running at 00:30 Paris time therefore
exports the day _before_ yesterday, which is what "UTC" in the script's own log
line is there to say.

Both bounds come from one call to `previousDay()` in `$lib/server/exportDay`, and
that is the point of the module: the rows the query selects and the date the
filename claims cannot drift apart, which a `current_date - 1` in SQL plus a
`new Date()` in JS could do every night. The window is half-open
(`>= start`, `< end`) so a report written at exactly midnight lands in one file,
not two.

`scripts/lib/exportCsv.ts` holds everything the two scripts share; they differ
only in the relation and its creation column — `created_at` for `missed_hour`,
`first_reported_at` for the `missed_hour_event` view. An empty day is ordinary
now (a Sunday, a holiday), so the header comes from the driver's row description
rather than the first row: the file is always written, header-only if need be,
because a downstream job that runs every morning should not have to tell "no
reports" apart from "the export broke". An empty run says which column decided
(`no missed_hour rows with created_at on 2026-09-05`), since "wrong day" and
"wrong column" produce the same empty file.

Both filter on when the row was **submitted**, not on `date`, the day of the
class it describes — a report filed on the 6th about a class missed on the 2nd
belongs in the 6th's file. That is what puts every row in exactly one day's
export; grouping by `date` instead would move rows between already-published
files every time someone reports an older class.

## Migrations

Schema changes are versioned Kysely migrations in `migrations/`, applied by a
plain Node script (`scripts/migrate.ts`). `drizzle-kit push` is gone — it diffed
`schema.ts` against the live database and generated DDL on the fly; these are
explicit, ordered, and reversible.

- `npm run db:migrate` — apply everything pending
- `npm run db:migrate:status` — applied vs pending, plus any orphans
- `npm run db:migrate:down` — roll back one migration
- `npm run db:types` — regenerate `db/types.generated.ts` from the database
- `npm run db:diff` — compare the migrated schema against the real one (read-only)

To add one:

1. write `migrations/00N_what_it_does.ts` exporting `up` and `down`
2. `npm run db:migrate`
3. `npm run db:types`
4. wire the column through: domain type → `repo/sql/` → both repos → action → UI.
   The compiler names every site once step 3 has run.
5. **The same files run against DuckDB**, via `duckdbDialect.ts` — applied by
   `npm run db:migrate:duckdb`, whether `DUCKDB_PATH` is a local file or an `md:`
   URL. There is no second hand-maintained DDL any more.
   There is no second hand-maintained DDL any more. The cost is that a migration
   has to be written in the SQL subset _both_ engines implement: DuckDB has no
   `serial` and no `generated as identity` (use an explicit sequence plus
   `defaultTo(sql\`nextval(…)\`)`), and its `alter table`supports neither`drop constraint`nor`add constraint`— so a change to a primary key means
rebuilding the table and renaming it into place, as`003`does. The DuckDB
row of`repo.conformance.spec.ts`replays every migration into`:memory:`on
each test run, so a statement DuckDB rejects fails`npm run test:unit`.

### Nothing migrates itself

**Migrations only ever run when you run them.** Not on connect, not on build, not
on the first request — for any backend, Postgres or DuckDB, local file or
MotherDuck. `npm run db:migrate` and `npm run db:migrate:duckdb` are the only
things that apply a migration, and both are started by a person or a pipeline.

The app used to migrate DuckDB as it opened it, which was fine while DuckDB meant
a local file: the OS write lock made this process the only possible migrator. It
stops being fine the moment `DUCKDB_PATH` is an `md:` URL. MotherDuck is a shared
network database with no such lock, several instances of the app open it at once,
and Kysely's migration lock is a deliberate no-op in `duckdbDialect.ts` — so every
instance would apply the same DDL against the same `kysely_migration` ledger. It
would also just fail on a serverless host: `FileMigrationProvider` reads
`migrations/` off disk, and a bundle does not contain that directory.

Migrate before the new code serves traffic, then deploy. Forgetting shows up as a
missing table — the same failure Postgres has always had here.

### There is no migration generator

Kysely has no equivalent of `prisma migrate dev` or `drizzle-kit generate`,
because it has no declarative schema to diff _from_ — the migrations are the
declaration. `kysely-ctl migrate:make` scaffolds an empty stub and nothing more;
`kysely-codegen` runs the other way (database → types). Advice to "just use
`migra`" is stale: it no longer imports on modern Python.

What replaces the generator is a checking loop:

- **`npm run db:types`** — the compiler then lists every call site to update, so
  the cost of a missed one is a build error rather than a runtime failure.
- **`npm run db:diff`** — builds nothing, only reads: it compares the database
  built from `migrations/` against the real one. Empty output means the
  migrations reproduce it exactly; anything listed is a migration you have not
  written, or drift applied outside them.

Never renumber or edit a migration that has already run anywhere — the ledger in
`kysely_migration` keys on the filename. Deleting an applied migration's file
makes `db:migrate` fail with `corrupted migrations`; `db:migrate:status` reports
it as `⚠ orphaned`. Fix mistakes with a new migration, not by editing an old one.

No ts-node and no dotenv package: Node 24 strips the types and reads `.env` via
`--env-file`. The only added dependency is `kysely-postgres-js`, Kysely's dialect
for the `postgres` driver the app already uses.

**`drizzle-orm` stays** — better-auth talks to the database through
`drizzleAdapter`. Only the migration tool changed.

## Which database am I talking to?

There are **two** Postgres databases and they are easy to confuse:

| env var               | target                            | role                                           |
| --------------------- | --------------------------------- | ---------------------------------------------- |
| `DATABASE_URL_NEON`   | Neon, `dev`                       | the shared/hosted database — **has real data** |
| `DATABASE_URL_DOCKER` | `localhost:5432`, `local`         | the `compose.yaml` container — disposable      |
| `DATABASE_URL`        | whichever of the two is copied in | what the app and `db:migrate` actually use     |

`DATABASE_URL` is the one the app reads, and it has pointed at **Neon** by default.
Do not assume it means localhost because Docker happens to be running — the
container can be up and completely unused.

**Before running anything against a database, print the host and say which one it
is.** For one-off scripts, pass the target explicitly rather than relying on
whatever `DATABASE_URL` currently holds:

```bash
node --env-file=.env -e "import('postgres').then(async ({default:pg}) => { const sql = pg(process.env.DATABASE_URL_DOCKER); /* ... */ })"
```

For anything destructive — `drop`, `truncate`, `delete`, or a migration `down` —
assert the target first and refuse if it does not match:

```js
const u = new URL(url);
if (!u.hostname.endsWith('neon.tech')) {
  console.error('wrong target', u.hostname);
  process.exit(1);
}
```

Never print the connection string itself; it contains the password. Print
`u.hostname` and the database name only.
