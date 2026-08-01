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

No test runner is configured yet. If you add one, wire it into a `test` script and document how to run a single test here.

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

## Maplibre GL

Use examples on https://svelte-maplibre-gl.mierune.dev/examples to help get good quality code for the mapping part.
