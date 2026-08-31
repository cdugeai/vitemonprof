# Production readiness checklist — ViteMonProf

## Context

The app works end-to-end in development: a French-language public form collects
"heures manquées" reports, stores them through `MissedHourRepo` (Postgres in
prod, DuckDB/memory otherwise), and renders stats plus a recent-reports list on
`/`. Deployment to Vercel already works.

What is _not_ ready is everything around that happy path. Three things are
outright broken or unscalable in production, and a long tail of content,
legal, and hygiene items are still at scaffold quality:

1. **School data.** `src/lib/server/data.ts` imports a CSV with Vite's `?raw`,
   which inlines the file into the serverless bundle as a JS string and parses
   it on every cold start. It currently points at the 100-row sample. Pointing
   it at the real dataset (63k rows, 25.8 MB) means a 26 MB string in the Vercel
   function and a 14 MB JSON response from `/api/schools`, which the map fetches
   on mount. **The dataset switch is the decision that forces a real data
   pipeline** — measured numbers in §1.
2. **Auth is wired but non-functional.** `src/lib/server/db/auth.schema.ts` is
   still the unrun generator stub — its whole body is a comment saying the
   `auth:schema` script has not been run — and `migrations/` has no better-auth
   tables at all, yet
   `src/hooks.server.ts` calls `auth.api.getSession()` on **every** request.
   Decision taken: keep auth wired but dormant for v1.
3. **The write path is unguarded.** Anonymous POST, no rate limit, no
   `schoolId` validation, no bound on report dates, and `list()` returns every
   row ever written to render five of them.

Decisions already made (do not re-open):

- **Host:** Vercel. Deployment works; leave `adapter-auto` alone.
- **Auth:** wired but dormant. Migrate the tables, hide the demo, gate nothing.
- **Schools:** ship the full ~62k dataset.
- **Dashboard:** minimal real version — a Département dropdown that scopes the
  stats to that department.

**How to use this file:** it is the shared state across sessions. Tick a box
only when the change is committed and `npm run check && npm run lint && npm test`
is green. When a checklist item turns out to be wrong or moot, strike it and say
why rather than deleting it — the reasoning is the useful part.

---

## §1 — P0 · School data pipeline

Measured on `data/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre.csv`
(63,017 rows; 62,228 are `OUVERT` **and** geolocated — 359 `A FERMER`, 74
`A OUVRIR`, ~380 with no coordinates):

| payload                           | raw     | gzipped |
| --------------------------------- | ------- | ------- |
| full `School[]` JSON (all fields) | 13.9 MB | 3.3 MB  |
| minimal `[id, name, lng, lat]`    | 4.4 MB  | 1.3 MB  |

- [ ] **Add a build step that converts the CSV into compact assets.** New
      `scripts/build-schools.ts`, run from a `prebuild` npm script. Move the
      parsing logic out of `src/lib/server/data.ts` — keep `parseCSV`'s header-map
      approach, add the `OUVERT` + has-coordinates filter, and emit two artifacts:
  - `static/schools.geojson` — minimal properties (`id`, `name`) only, for the
    map. ~1.3 MB gzipped, served as a static asset with a long cache header, so
    it never touches the serverless function.
  - `src/lib/server/schools.generated.json` (or a `data/` artifact read at
    runtime) — the full records, for `/api/schools?id=` and the typeahead.
- [ ] **Add `department` to `School`** (`src/lib/types/school.ts`) from CSV column
      `Code INSEE du département ou de la collectivité`. Needed by §4.
      **Do not derive it from the UAI prefix** — verified against the real data,
      the prefix disagrees for ~1,040 schools (Corsica `620`/`720` → `2A`/`2B`,
      and the overseas collectivities `983`→`988`, `984`→`987`, `971`→`977/978`).
- [ ] **Stop `MapMain.svelte` fetching `/api/schools`.** Point the MapLibre source
      at `/schools.geojson` and let MapLibre do the clustering — the constants are
      already there (`MAP_CLUSTER_MAX_ZOOM`, `MAP_CLUSTER_RADIUS` in
      `src/lib/constants.ts`). Follow the clustering example at
      https://svelte-maplibre-gl.mierune.dev/examples. This removes the `onMount`
      fetch in `src/lib/components/MapMain.svelte:18` entirely.
- [ ] **Remove the unbounded `/api/schools` response.** `src/routes/api/schools/+server.ts`
      returns `getSchools()` — every school — when called with no params. With the
      full dataset that is a 14 MB JSON body. Make `id=` or `query_string=`
      mandatory and `error(400, …)` otherwise. `MAX_IDS` (50) and
      `MAX_SEARCH_RESULTS` (10) already cap the other two paths.
- [ ] **Precompute the search index.** `getSchoolsFilterName` calls
      `normalizeText` (NFD normalize + regex) on every school's name on every
      keystroke. At 62k rows that is a visible typeahead stall. Normalize once at
      build time and store the result alongside each record; the filter then
      becomes a plain `includes` on a prepared string.
- [ ] **Decide how the 25.8 MB CSV lives in git.** It is committed today. Either
      keep it (simple, bloats every clone) or move it behind Git LFS / a fetch
      step in `prebuild`. Note the sample stays useful for tests.
- [ ] **Verify the Vercel function bundle.** After the above, `?raw` should be
      gone from `src/lib/server/data.ts`. Confirm with `npm run build` that no
      multi-MB string is inlined into the server chunk.

## §2 — P0 · better-auth: make dormant mean dormant

- [x] **Generate the schema.** `npm run auth:schema` — overwrites the stub at
      `src/lib/server/db/auth.schema.ts`, which `src/lib/server/db/schema.ts`
      re-exports into `drizzleAdapter(db)`. Two things to know before touching it
      again: the generator formats with its own bundled Prettier defaults (double
      quotes, 80 columns) and never reads `.prettierrc.json`, so `npm run format`
      afterwards is not optional; and the **column names it emits are
      snake_case** (`email_verified`, `user_id`) while the TypeScript property
      names stay camelCase, because `camelCase` is unset in the adapter config
      and `convertToSnakeCase` therefore applies to every field. Migration 004
      had to match the columns, not the properties.
- [x] **Write `migrations/004_better_auth.ts`** for `user`, `session`, `account`,
      `verification`. Text primary keys throughout — better-auth generates its
      own string ids, so no sequence and no `nextval` were needed and DuckDB's
      missing `serial` never came up. Two judgement calls are recorded in the
      file's own doc comment:
  - **`on delete cascade` is applied on Postgres only.** DuckDB parses the
    constraint but rejects the action outright (`FOREIGN KEY constraints cannot
use CASCADE, SET NULL or SET DEFAULT`), so the migration probes
    `select version()` — the one discriminator that works, since `DuckDbAdapter`
    reports the same capabilities as `PostgresAdapter` — and adds the action for
    Postgres, the only engine better-auth ever talks to. DuckDB still enforces
    the plain key.
  - **Timestamps are `timestamp with time zone`** even though the generated
    Drizzle schema says plain `timestamp()`. Drizzle builds no DDL any more, and
    postgres-js parses oids 1082/1114/1184 through the same `new Date(x)` — so a
    tz-less column reads back as _local_ time and silently shifts
    `session.expires_at` off UTC.
  - ~~`npm run db:types`~~ — moot. `scripts/gen-types.ts` excludes
    `(user|session|account|verification|…)` on purpose, so the generated types do
    not move. Verified: the file comes back byte-identical.
- [x] **Narrow the session lookup in `src/hooks.server.ts`.** `getSession()` now
      runs only when the request carries a better-auth cookie (`getSessionCookie`
      from `better-auth/cookies` — header parsing only, no crypto, no database)
      and the path is not under `/api/`. `svelteKitHandler` deliberately still
      runs on every path: `/api/auth/*` lives under `/api/`, so an early
      `resolve(event)` would take better-auth's whole HTTP surface offline.
- [x] **Hide the demo routes.** Deleted outright — `src/routes/demo/` and its
      five files. Guarding on `dev` would have left the `signUpEmail` action one
      env flag from live. Nothing else referenced them; `src/app.d.ts` keeps its
      `Locals` declaration, which now has a writer and no reader, as intended.
- [x] **Close better-auth's own endpoints** — _not in the original list, and the
      gap this section would otherwise have shipped with._ Deleting the demo
      pages removes the UI, not the routes: `svelteKitHandler` serves
      `POST /api/auth/sign-up/email` whether or not anything links to it, so
      anonymous account creation against Neon stayed open. `src/lib/server/auth.ts`
      now sets `emailAndPassword: { enabled: false }`, which unregisters sign-up
      and sign-in both. Verified that this does not move the generated schema —
      `account.password` is unconditional in better-auth's table definitions.
      When a real login lands, the graduated options are
      `{ enabled: true, disableSignUp: true }` (sign-in works, sign-up 400s
      everywhere) or top-level `disabledPaths: ['/sign-up/email']` (the router
      404s the HTTP route while `auth.api.signUpEmail()` stays callable from a
      server action — the shape an invite-only flow needs).
- [x] **Apply 004 to both Postgres targets.** Docker first, then Neon `dev`;
      `npm run db:diff` reports `schemas match`. Both foreign keys report a
      delete rule of `CASCADE` on Postgres, so the `select version()` probe does
      what it claims — and DuckDB gets the plain key, which the conformance suite proves
      on every `npm run test:unit`. The `down()` drop order was smoke-tested on
      the container only (down, verify the four tables are gone, up); the
      conformance suite never runs `down`, so that path has no other coverage.
- [ ] **Confirm `ORIGIN` and `BETTER_AUTH_SECRET` are set in Vercel.**
      `src/lib/server/auth.ts` reads both from `$env/dynamic/private`. `ORIGIN`
      must be scheme + host with no trailing slash: it becomes better-auth's
      `baseURL`, and `isAuthPath` compares `url.origin !== baseURL.origin`, so a
      mismatch makes every `/api/auth/*` request fall through to SvelteKit and 404. Secret must be 32+ chars of real entropy, per `.env.example`.

## §3 — P0 · Write path: abuse, validation, and unbounded reads

- [ ] **Bound `list()`.** `src/lib/server/repo/types.ts` documents "all reports,
      newest first"; `+page.server.ts` streams the whole result to the browser so
      `RecentReports.svelte` can `.slice(0, 5)`. Add a `limit` argument to the port
      and thread it through `listMissedHours()` in
      `src/lib/server/repo/sql/missedHourQueries.ts` and all three backends. The
      conformance suite in `repo.conformance.spec.ts` gives you a free check that
      every backend agrees.
- [ ] **Validate `schoolId` against the registry.** `+page.server.ts` accepts any
      non-empty string. Reuse `getSchoolsInfo([id])` from `src/lib/server/data.ts`
      — an unknown id must `fail(400)`. This is the same lookup that yields the
      department for §4, so it pays for itself.
- [x] **Bound the date.** `isCalendarDate()` now rejects future dates and anything
      older than ~1 school year (365 days).
- [ ] **Rate-limit the POST.** It is anonymous, unauthenticated, and writes a row
      per request. Pick one and note the choice in the file: a per-IP counter in
      Postgres, an Upstash/Vercel KV limiter, or a hidden honeypot field plus a
      minimum time-to-submit. At minimum, cap submissions per IP per hour.
- [ ] **Make the repo singleton lazy.** `src/lib/server/repo/index.ts` ends with
      `export const missedHourRepo: MissedHourRepo = await createRepo()` —
      top-level await at module load. On Vercel that means every cold start opens
      Postgres during import; if Neon is suspended or unreachable the whole
      function fails to boot with an opaque error rather than one bad request.
      Export a memoized `getRepo()` instead and call it from the load/action.
      Update `+page.server.ts` and any other caller.
- [ ] **Confirm `MISSED_HOUR_REPO=postgres` in Vercel.** `resolveBackend()`
      defaults to postgres when unset, but making it explicit is what stops a
      stray `memory` value silently discarding every report.

## §4 — P1 · Persist the department, then build the minimal dashboard

The form already renders `SelectorDepartement.svelte` and posts a `dept` hidden
input — and `+page.server.ts` **never reads it**. It is collected and dropped.
The dropdown's real job on `/` is filtering the map, and the user's chosen
department can disagree with the school they then pick, so the stored value must
come from the registry, not the form.

- [ ] **`migrations/005_missed_hour_department.ts`** — add a nullable `department`
      text column. Nullable because existing rows have no value; backfill them in
      the same migration by mapping `school_id` through the registry if you want
      historical rows to appear in department stats. Then `npm run db:types`.
- [ ] **Thread it through**, in the order `CLAUDE.md` prescribes: domain type
      (`src/lib/types/missedHours.ts`) → `repo/sql/missedHourQueries.ts` →
      all three repos → the action → the UI. Once `db:types` has run, the compiler
      names every site.
- [ ] **Populate it in the action** from the `getSchoolsInfo()` lookup added in §3,
      not from `formData.get('dept')`.
- [ ] **Add `stats(department?)`** to `MissedHourRepo`. `statsMissedHours()`
      already builds the four aggregates in one round trip; add an optional
      `where` on `department`. The memory backend needs the same filter so the
      conformance suite stays honest.
- [ ] **Rebuild `/dashboard`.** Today `src/routes/dashboard/+page.svelte` is
      entirely hardcoded — "Chart placeholder", two cards reading "Loading..." that
      never load, and `<RecentReports missed_hours={[]} />`. Replace with: a
      `+page.server.ts` that reads `?dept=` from the URL, the existing
      `SelectorDepartement.svelte`, the real `stats()` numbers, and the real
      recent-reports list scoped to the department. Drop the chart card until
      there is enough data to chart.

## §5 — P1 · Data quality

- [x] **Drop the dead `task` table.** Created `migrations/005_drop_task.ts` and
      applied to both Postgres (Neon) and DuckDB. The conformance suite confirms
      the migration runs against both backends.
- [ ] **Decide on duplicate submissions.** Nothing prevents the same report being
      submitted repeatedly — the 303 redirect only stops accidental _browser_
      resubmission. Consider a unique constraint on
      `(school_id, class, class_group, date, discipline)` or accept duplicates
      deliberately and say so in a comment.

## §6 — P2 · Content, SEO, and correctness of what ships

- [ ] **No page has a `<title>`.** `src/routes/+layout.svelte` sets only the
      favicon and a font preload. Add `<svelte:head>` with title + meta description
      per route, and Open Graph tags for link previews.
- [ ] **`<html lang="en">`** in `src/app.html:2` on a French-language app → `fr`.
- [ ] **Favicon is still the Svelte logo** (`src/lib/assets/favicon.svg` — its own
      `<title>` says `svelte-logo`).
- [ ] **Typo in the H1**: "abscences" → "absences", `src/routes/+page.svelte:68`.
      `e2e/smoke.spec.ts:6` asserts on the misspelling and must change with it.
- [ ] **Mixed languages.** `/about` and `/dashboard` are entirely in English while
      the rest of the app is French. Translate them.
- [ ] **`/about` is placeholder copy** — "Send us an email or fill out our contact
      form" with neither an address nor a form.
- [ ] **No `+error.svelte`.** A 404 or a 500 currently renders SvelteKit's default
      black-and-white page with no navigation back.
- [ ] **`src/lib/components/Navbar.svelte:2` imports `page` from `$app/stores`** —
      the deprecated store API. Every other file uses `$app/state` (see
      `+page.svelte:15`). Switch it and drop the `$page` prefixes.

## §7 — P2 · Legal (France / RGPD)

- [ ] **Mentions légales page** — legally required for a French public-facing site.
- [ ] **Privacy notice.** The app collects reports naming an identifiable school,
      class, and date. Even without accounts, that plus an IP address (which §3's
      rate limiter will store) is personal data under RGPD. Document what is
      collected, why, retention, and how to request deletion.
- [ ] **Moderation/takedown story.** Reports are public and name real schools;
      decide what happens when one is disputed.
- [ ] **Check `static/robots.txt`** matches the intent — it currently allows
      crawling everything.

## §8 — P3 · Infrastructure hygiene

- [ ] **No CI.** There is no `.github/` directory, so `npm test`, `npm run check`
      and `npm run lint` never run on push. Add a workflow; `playwright.config.ts`
      already handles CI (`reporter: 'github'`, `reuseExistingServer: false`,
      `MISSED_HOUR_REPO: memory`), so the E2E suite needs no database.
- [ ] **README is the `sv` scaffold default** — still titled "# sv" and telling the
      reader to run `npx sv create`. Replace with what the project is, how to run
      it, and where the env vars come from. `README_tech.md` holds three real
      lines; fold them in.
- [ ] **No error tracking.** Add Sentry or Vercel's own, plus a `handleError` hook
      in `src/hooks.server.ts` — right now a 500 in production leaves no trace
      beyond Vercel's raw function log.
- [ ] **Security headers.** No CSP, HSTS, or `X-Content-Type-Options`. Set them in
      `vercel.json` or a `handle` hook. Note the map pulls a style from
      `basemaps.cartocdn.com`, which any CSP has to allow.
- [ ] **Audit the dependency split.** Nearly everything is in `devDependencies`,
      including `better-auth`, `drizzle-orm`, `postgres`, and `svelte-maplibre-gl`.
      Vite bundles them so the build works, but the split no longer describes what
      is a runtime dependency.

---

## Verification

Per item, and again before shipping:

```bash
npm run check && npm run lint && npm test
```

`npm test` runs Vitest (including `repo.conformance.spec.ts`, which replays
every migration into an in-memory DuckDB — so a migration either engine rejects
fails here) then Playwright against a memory-backed dev server.

Migration items additionally:

```bash
npm run db:migrate:status && npm run db:diff
```

Empty `db:diff` output means the migrations reproduce the live schema exactly.
Per `CLAUDE.md`, print the target host before touching any database and never
renumber a migration that has already run.

The school-data pipeline (§1) needs an eyes-on check the test suite cannot give:
run the dev server, confirm the map clusters and expands, confirm the typeahead
stays responsive while typing, and confirm `npm run build` produces a server
bundle with no inlined CSV.
