# ViteMonProf

**Un observatoire participatif des heures de cours non remplacées, en France.**

[vitemonprof.fr](https://vitemonprof.fr) · [Jeu de données ouvert](https://www.data.gouv.fr/datasets/vitemonprof-soumissions) · Soumission anonyme, en deux minutes

---

## Le problème : on ne sait pas compter ce qui est perdu

Quand un enseignant est absent pour quelques jours, une partie des heures de
cours n'est ni remplacée, ni rattrapée. Personne ne conteste que ces heures
existent. Ce qui manque, c'est leur compte.

Trois constats, tous publics :

- **L'écart entre la cible et le réel.** Le Pacte enseignant prévoyait que
  **20,5 %** des absences de courte durée soient remplacées en 2023-2024.
  Un audit cité au Sénat en 2025 conclut que **10 %** l'ont effectivement été.
  ([question au Sénat](https://www.senat.fr/questions/base/2025/qSEQ250705531.html),
  [le Pacte enseignant](https://www.education.gouv.fr/les-missions-complementaires-du-pacte-enseignant-378856))

- **La mesure elle-même est fragile.** Le guide Eduscol du remplacement de courte
  durée le dit page 31 : les données « reposent sur des pratiques de saisies des
  absences et des remplacements encore trop diverses en fonction des
  établissements », et leur fiabilisation reste « un enjeu commun d'amélioration
  entre les académies et l'administration centrale ».
  ([guide RCD, PDF](https://eduscol.education.gouv.fr/sites/default/files/document/remplacement-de-courte-duree-rcd-guide-l-usage-du-chef-d-etablissement-107223.pdf))

- **L'outil qui doit y répondre n'existe pas encore.** Un portail unique
  intégrant absences et remplacement doit être déployé dans les DSDEN entre
  **mars 2026** (Toulouse et La Réunion) et **2028** ; le nouveau logiciel de
  gestion des remplaçants est annoncé pour l'**automne 2027**. Le ministère vise
  **95 %** de remplacement effectif d'ici un à deux ans.
  ([SNALC, janvier 2026](https://snalc.fr/remplacement-des-pe-absents-cr-28jan26/),
  [SE-UNSA, décembre 2025](https://www.se-unsa.org/2025/12/refonte-du-remplacement-gt-du-4-decembre-2025/))

Autrement dit : une cible ambitieuse, un système de mesure que l'administration
reconnaît comme hétérogène, et un outil unifié qui arrive au mieux dans deux ans.
Entre-temps, les chiffres existent par établissement, rarement à l'échelle d'un
département, presque jamais à celle du pays — et jamais du point de vue de ceux
qui subissent l'heure perdue.

## Ce que fait ViteMonProf

ViteMonProf ouvre un canal de mesure complémentaire, par le bas : familles,
élèves et personnels soumettent les heures non remplacées qu'ils constatent, et
le site en tire des totaux par établissement, par matière, par département et
pour la France entière.

**L'objet mesuré est l'heure, pas la personne.** Une absence est légitime ; ce
que compte le site, c'est l'heure d'enseignement qui n'a pas eu lieu,
c'est-à-dire un fait d'organisation et de moyens de remplacement. Aucune donnée
nominative sur un agent n'est collectée, et les soumissions sont anonymes — ni
compte, ni adresse IP conservée dans les exports.

### Une unité : l'heure de cours non remplacée

Chaque soumission porte l'établissement, la classe, la date et le nombre
d'heures. La matière et le groupe sont facultatifs. La date est bornée
(`src/lib/reportDate.ts`) : au plus un jour dans le futur, au plus un an dans le
passé, en UTC — le territoire français s'étale de UTC-10 à UTC+12, donc aucun
minuit local n'est le minuit de tout le monde.

### Le dédoublonnage est le cœur du projet

Cinq personnes qui soumettent la même heure de maths annulée décrivent **une**
heure perdue, pas cinq. Sommer naïvement les soumissions surestimait les totaux
de **54 %** sur les données réelles.

La vue `missed_hour_event` (`migrations/007_missed_hour_event_view.ts`) regroupe
donc les soumissions sur une clé de corroboration — établissement, classe,
groupe, date, matière, durée — et **tous** les agrégats du site lisent cette vue,
jamais la table brute. Le nombre de soumissions derrière un événement reste
affiché : il ne gonfle plus le total, il en indique la fiabilité.

La conformité entre la vue SQL et la constante `CORROBORATION_KEY` du code est
vérifiée par la suite de tests, pour qu'une dérive casse la CI plutôt que les
statistiques.

### Les données sont ouvertes, tous les jours

Toutes les soumissions sont publiées sur data.gouv.fr, dans le jeu de données
[ViteMonProf — Soumissions](https://www.data.gouv.fr/datasets/vitemonprof-soumissions),
par un job quotidien à 02:00 UTC (`.github/workflows/publish-datagouv.yml`).

Ce qui est publié, ce sont les **soumissions brutes**, pas la vue dédoublonnée :
les soumissions sont la donnée, la vue n'est que notre lecture de cette donnée.
Publier la lecture à la place des faits rendrait le jeu de données plus difficile
à vérifier, pas plus facile.

### Les limites, énoncées d'entrée

Les données viennent de contributions volontaires. Elles ne sont **ni
exhaustives, ni représentatives** : un territoire mobilisé apparaîtra plus touché
qu'un territoire silencieux. Ces chiffres décrivent ce qui est soumis, pas la
réalité complète du remplacement en France. Le site le dit sur sa page
[À propos](https://vitemonprof.fr/about) et ce README le répète — c'est une
mesure complémentaire, pas un substitut à la statistique publique.

---

## Le projet en pratique

### Démarrer

```bash
npm install
npm run dev
```

Le registre national des établissements (~27 Mo, 63 000 lignes) est téléchargé
automatiquement par `predev` / `prebuild` ; il n'est pas versionné.

| Commande                            | Effet                                                       |
| ----------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                       | serveur de développement Vite                               |
| `npm run build` / `npm run preview` | build de production, puis prévisualisation                  |
| `npm run check`                     | vérification de types Svelte + TypeScript                   |
| `npm run lint` / `npm run format`   | Prettier + ESLint                                           |
| `npm test`                          | Vitest (unitaires + contrat de dépôt) puis Playwright (E2E) |
| `npm run data:schools -- --force`   | rafraîchir le registre des établissements                   |

### Base de données

Les changements de schéma sont des migrations Kysely versionnées dans
`migrations/`, appliquées explicitement — **rien ne migre tout seul**, ni au
démarrage, ni au premier appel.

```bash
npm run db:migrate          # appliquer les migrations en attente
npm run db:migrate:status   # appliquées vs en attente
npm run db:types            # régénérer les types depuis la base
npm run db:diff             # comparer le schéma migré au schéma réel (lecture seule)
```

Les mêmes fichiers de migration s'appliquent à Postgres et à DuckDB, ce qui
impose de rester dans le sous-ensemble SQL commun aux deux moteurs.

### Publication open data

```bash
npm run db:export:hours              # exporter les soumissions de la veille en CSV
npm run db:publish -- --dry-run      # préparer la publication sans appel réseau
npm run db:publish -- --day 2026-09-01  # rejouer un jour manqué
```

Republier un jour **remplace** la ressource existante plutôt que d'en créer une
seconde : le script est idempotent par journée.

### Architecture

- **SvelteKit** + **Svelte 5** en mode runes forcé pour tout le code applicatif.
- **Tailwind CSS v4** + **shadcn-svelte** pour l'interface, **MapLibre GL** pour
  la carte des établissements.
- **Kysely** au-dessus de Postgres ; un port `MissedHourRepo` avec plusieurs
  implémentations (Postgres, DuckDB, mémoire) et **une seule suite de contrat**
  rejouée contre chacune (`src/lib/server/repo/repo.conformance.spec.ts`).
- Les lectures passent par un cache LRU de cinq minutes appliqué **au port**, pas
  aux backends : l'écriture unique du dépôt est donc le seul point
  d'invalidation possible.
- `/api/schools` répond en **gzip typé `application/gzip`** — 11 Mo de JSON, 2,5 Mo
  compressés — décompressé côté client avec pako.
- Tests : **Vitest** (`src/**/*.spec.ts`, `scripts/**`) et **Playwright** (`e2e/`),
  ce dernier sur un dépôt en mémoire, donc sans base de données.

Les décisions de conception et leurs raisons sont documentées en détail dans
[`CLAUDE.md`](CLAUDE.md).

---

## Contribuer

Les contributions sont bienvenues : issues, correctifs, ou simplement des
soumissions sur le site. Le développement se fait par branche et pull request.

Le code est en anglais (identifiants, commentaires, commits) ; l'interface et la
documentation destinée au public sont en français.

## Crédits et licences

- Registre des établissements :
  [annuaire de l'éducation](https://data.education.gouv.fr/explore/dataset/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre/),
  sous [Licence Ouverte / Etalab](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).
- Fonds de carte : [OpenStreetMap](https://www.openstreetmap.org/copyright) et
  [CARTO](https://carto.com/attribution).
- Soumissions publiées sur data.gouv.fr sous les conditions du jeu de données.
- Licence du code : à préciser.

Auteur : [Colin Dugeai](https://www.linkedin.com/in/colin-dugeai) —
contact@vitemonprof.fr
