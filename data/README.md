## Data sources

Schools: https://data.education.gouv.fr/explore/dataset/fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre/

The CSV itself is **not tracked** (see `.gitignore` here) — it is ~27 MB of
regenerable third-party data. `npm run data:schools` downloads it, and
`predev`/`prebuild` run that for you, so a fresh clone needs no manual step.

Pass `-- --force` to refresh it; the dataset changes upstream (63 018 rows in
one snapshot, 63 986 a while later).
