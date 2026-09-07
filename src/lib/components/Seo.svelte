<script lang="ts">
  import { page } from '$app/state';
  import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME } from '$lib/seo';

  interface Props {
    /**
     * The page's own title, without the site name — the component appends that.
     * Keeping the two apart is what lets `og:title` and `<title>` stay in sync
     * while each page only states the part that is actually its own.
     */
    title: string;
    /** Falls back to the site description. Aim for 150–160 characters. */
    description?: string;
    /** `article` for a dated, authored page; `website` for everything else. */
    type?: 'website' | 'article';
    /** Keeps the page out of the index while still following its links. */
    noindex?: boolean;
  }

  let {
    title,
    description = SITE_DESCRIPTION,
    type = 'website',
    noindex = false,
  }: Props = $props();

  const fullTitle = $derived(`${title} — ${SITE_NAME}`);

  // Open Graph requires absolute URLs — a crawler resolves nothing relative, so
  // `/og-image.jpg` would simply be dropped and the card would render without an
  // image. `page.url` is the request's own URL during SSR (which is the only pass
  // a crawler sees), so this is right in dev, in preview and in production without
  // a hardcoded domain to keep in sync.
  //
  // Query and hash are deliberately dropped: `?submitted=1` and `/#form` are the
  // same document, and letting them through would split the canonical signal and
  // give every shared link a different `og:url`.
  const canonical = $derived(new URL(page.url.pathname, page.url.origin).href);
  const imageUrl = $derived(new URL(OG_IMAGE.path, page.url.origin).href);
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />

  {#if noindex}
    <meta name="robots" content="noindex, follow" />
  {/if}

  <!-- Open Graph — read by Facebook, WhatsApp, iMessage, LinkedIn, Slack, Discord. -->
  <meta property="og:type" content={type} />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:width" content={String(OG_IMAGE.width)} />
  <meta property="og:image:height" content={String(OG_IMAGE.height)} />
  <meta property="og:image:alt" content={OG_IMAGE.alt} />

  <!-- X reads Open Graph for everything else, but it needs to be told the card is
       the wide one; without this it renders the small square `summary` card. -->
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
