import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },

      // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
      // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
      // See https://svelte.dev/docs/kit/adapters for more information about adapters.
      adapter: adapter(),

      typescript: {
        config: (config) => {
          config.include.push('../drizzle.config.ts');
        },
      },
    }),
  ],
  assetsInclude: ['**/*.csv'],
  build: {
    // Vite 8 defaults to `baseline-widely-available`, which is
    // ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'].
    //
    // maplibre-gl ships ES2022 class static blocks (`static { ... }`), supported
    // only from iOS 16.4. Under the default target they are emitted as-is, so an
    // older iPhone cannot *parse* the route chunk: the dynamic import throws
    // `SyntaxError: Unexpected token '{'` during hydration and SvelteKit replaces
    // the whole page with its error page. Nothing reaches the server, so the
    // failure is invisible in server logs.
    //
    // Every browser on iOS is required to use WebKit, so this affects Firefox and
    // Chrome on an old iPhone too — not just Safari.
    target: ['chrome111', 'edge111', 'firefox114', 'safari15', 'ios15'],
    // DEFAULT ["chrome111", "edge111", "firefox114", "safari16.4", "ios16.4"]
  },
  optimizeDeps: {
    exclude: ['svelte-maplibre-gl'],
  },
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
});
