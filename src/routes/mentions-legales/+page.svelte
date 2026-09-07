<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import Seo from '$lib/components/Seo.svelte';

  /**
   * The one address the public can reach the publisher at. It has to be a real,
   * monitored mailbox: it is the only channel for the notifications this page
   * announces (signalements, demandes de retrait).
   *
   * TODO(before launch): point this at a mailbox that exists.
   */
  const CONTACT_EMAIL = 'contact@vitemonprof.fr';

  /** Last time the content of this page actually changed, not the last deploy. */
  const LAST_UPDATED = '31 août 2026';
</script>

<!-- `noindex` because this is boilerplate that would only dilute the crawl budget and
     compete with the pages that matter. `follow` is deliberate: the outbound links stay
     meaningful. -->
<Seo
  title="Mentions légales"
  description="Mentions légales de ViteMonProf : éditeur, directeur de la publication, hébergeur, sources de données et propriété intellectuelle."
  noindex
/>

<div class="mx-auto max-w-4xl px-4 py-12">
  <h1 class="mb-2 text-4xl font-bold">Mentions légales</h1>
  <p class="text-muted-foreground mb-8 text-sm">Dernière mise à jour : {LAST_UPDATED}</p>

  <Card.Root>
    <Card.Content class="space-y-8 pt-8">
      <section>
        <h2 class="mb-4 text-2xl font-bold">Éditeur du site</h2>
        <p class="text-gray-700">
          Le site <strong>ViteMonProf</strong> est édité par une personne physique agissant à titre non
          professionnel.
        </p>
        <p class="mt-3 text-gray-700">
          Conformément à l'article 6, III, 2° de la loi n° 2004-575 du 21 juin 2004 pour la
          confiance dans l'économie numérique, l'éditeur, en sa qualité de personne physique éditant
          le site à titre non professionnel, a choisi de ne pas rendre publiques ses coordonnées. Il
          a communiqué son identité, son adresse et son numéro de téléphone à l'hébergeur du site,
          identifié ci-dessous, qui les tient à la disposition de l'autorité judiciaire.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Directeur de la publication</h2>
        <p class="text-gray-700">
          Le directeur de la publication est l'éditeur du site, dont l'identité est détenue par
          l'hébergeur dans les conditions rappelées ci-dessus.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Contact</h2>
        <p class="text-gray-700">
          Toute demande relative au site peut être adressée à
          <a class="text-primary font-medium underline" href="mailto:{CONTACT_EMAIL}"
            >{CONTACT_EMAIL}</a
          >.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Hébergeur</h2>
        <p class="text-gray-700">
          Le site est hébergé par <strong>Vercel Inc.</strong>
        </p>
        <address class="mt-3 space-y-1 text-gray-700 not-italic">
          <p>440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</p>
          <p>Téléphone : <a class="underline" href="tel:+15592887060">+1 559 288 7060</a></p>
          <p>
            <a
              class="text-primary underline"
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer">vercel.com</a
            >
          </p>
        </address>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Sources des données</h2>
        <p class="text-gray-700">
          L'annuaire des établissements affiché sur la carte provient du jeu de données
          <em
            >« Adresse et géolocalisation des établissements d'enseignement du premier et second
            degré »</em
          >
          publié par le ministère de l'Éducation nationale sur
          <a
            class="text-primary underline"
            href="https://data.education.gouv.fr/explore/dataset/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre/"
            target="_blank"
            rel="noopener noreferrer">data.education.gouv.fr</a
          >, sous
          <a
            class="text-primary underline"
            href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/"
            target="_blank"
            rel="noopener noreferrer">Licence Ouverte / Open Licence (Etalab)</a
          >.
        </p>
        <p class="mt-3 text-gray-700">
          Le fond de carte est fourni par <a
            class="text-primary underline"
            href="https://carto.com/attribution"
            target="_blank"
            rel="noopener noreferrer">CARTO</a
          >
          à partir des données
          <a
            class="text-primary underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer">© les contributeurs OpenStreetMap</a
          >, sous licence ODbL.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Propriété intellectuelle</h2>
        <p class="text-gray-700">
          Hors les données mentionnées ci-dessus, qui restent soumises à leurs licences respectives,
          la structure du site, ses textes et ses éléments graphiques sont la propriété de
          l'éditeur. Toute reproduction ou représentation, totale ou partielle, sans autorisation
          préalable est interdite.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Signalement d'un contenu</h2>
        <p class="text-gray-700">
          Les signalements publiés sur ViteMonProf sont déposés par les visiteurs. Tout contenu
          estimé inexact, diffamatoire ou portant atteinte aux droits d'un tiers peut être signalé à
          <a class="text-primary font-medium underline" href="mailto:{CONTACT_EMAIL}"
            >{CONTACT_EMAIL}</a
          >, en précisant la page concernée et le motif du signalement.
        </p>
      </section>
    </Card.Content>
  </Card.Root>
</div>
