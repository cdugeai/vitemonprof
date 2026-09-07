<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
  <title>À propos — ViteMonProf</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-12">
  <h1 class="mb-8 text-4xl font-bold">À propos de ViteMonProf</h1>

  <Card.Root class="space-y-6">
    <Card.Content class="space-y-8 pt-0">
      <section>
        <h2 class="mb-4 text-2xl font-bold">Pourquoi cet observatoire</h2>
        <p class="text-gray-700">
          Quand une heure de cours n'est pas remplacée, elle ne se rattrape pas. Pourtant, personne
          ne sait vraiment combien d'heures sont perdues chaque année : les chiffres existent par
          établissement, rarement à l'échelle d'un département, presque jamais à celle du pays.
        </p>
        <p class="mt-3 text-gray-700">
          ViteMonProf est un <strong>observatoire participatif</strong>. Il rassemble des
          signalements volontaires pour construire, ensemble, une vue d'ensemble que personne ne
          possède seul.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Accéder aux données</h2>
        <p class="text-gray-700">
          Toutes les données des soumissions sont en accès libre, exportées quotidiennement sur <a
            href="https://www.data.gouv.fr"
            class="text-blue-600 underline"
            target="_blank">data.gouv.fr</a
          >
          dans le jeu de données
          <a
            href="https://www.data.gouv.fr/datasets/vitemonprof-soumissions"
            target="_blank"
            class="text-blue-600 underline">ViteMonProf - Soumissions</a
          >.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Ce que l'observatoire compte</h2>
        <p class="text-gray-700">
          Une unité : l'heure de cours non remplacée. Chaque signalement précise l'établissement, la
          classe, la date et le nombre d'heures ; la matière et le groupe sont facultatifs.
        </p>
        <p class="mt-3 text-gray-700">
          De ces signalements se déduisent des totaux par établissement, par matière, par
          département et pour la France entière.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">À qui cela sert</h2>
        <ul class="list-inside list-disc space-y-2 text-gray-700">
          <li>
            <strong>Aux familles et aux élèves</strong>, pour situer ce qu'ils vivent dans un
            ensemble plus large.
          </li>
          <li>
            <strong>Aux personnels et aux établissements</strong>, pour disposer de chiffres sur
            leur zone plutôt que d'impressions.
          </li>
          <li>
            <strong>Aux collectivités et aux chercheurs</strong>, pour comparer les territoires et
            suivre l'évolution dans le temps.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Comment contribuer</h2>
        <ol class="list-inside list-decimal space-y-2 text-gray-700">
          <li>Choisissez l'établissement, dans la liste ou sur la carte.</li>
          <li>Indiquez la classe, la date et le nombre d'heures concernées.</li>
          <li>La matière et le groupe sont facultatifs — signalez même sans eux.</li>
          <li>Envoyez. C'est anonyme et cela prend deux minutes.</li>
        </ol>
        <p class="mt-3 text-gray-700">
          Plusieurs personnes peuvent signaler la même heure : c'est utile. Les signalements
          concordants sont regroupés et comptés <strong>une seule fois</strong> dans les totaux, et leur
          nombre indique la fiabilité de l'information.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Nos limites</h2>
        <p class="text-gray-700">
          Les données viennent de contributions volontaires : elles ne sont ni exhaustives, ni
          représentatives, et un territoire très actif apparaîtra plus touché qu'un territoire
          silencieux. Ces chiffres décrivent ce qui est signalé, pas la réalité complète du
          remplacement en France. Nous préférons le dire clairement.
        </p>
      </section>

      <section>
        <h2 class="mb-4 text-2xl font-bold">Nous écrire</h2>
        <p class="text-gray-700">
          Une question, une remarque, une erreur à signaler ? Les coordonnées de contact figurent
          dans les mentions légales.
        </p>
        <p class="text-gray-700">
          L'auteur de ce site est
          <a
            href="https://www.linkedin.com/in/colin-dugeai"
            target="_blank"
            class="text-blue-600 underline">Colin DUGEAI</a
          >.
        </p>
        <Button href="/mentions-legales" variant="outline" class="mt-4">Mentions légales</Button>
      </section>
    </Card.Content>
  </Card.Root>
</div>
