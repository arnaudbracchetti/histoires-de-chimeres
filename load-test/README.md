# Test de charge de l'API

Scripts k6 du [plan de test de charge](../docs/load-test/plan.md). Ce dossier ne fait pas partie du workspace pnpm.

## Prérequis

- k6 2.x installé sur le poste (apt ou binaire des releases de `grafana/k6`).
- `pnpm build` à la racine : les scripts importent `packages/contract/dist/index.js`.
- `cp .env.example .env`, puis y mettre les identifiants de l'Organisateur de test2.
- Une base de test2 remise à zéro : la préparation refuse une convention qui a déjà des créneaux ou des tables.

## Lancer

Depuis `load-test/` :

```sh
set -a; . ./.env; set +a
k6 run k6/load-test.ts
```

`setup()` connecte l'Organisateur, puis crée la convention du jour : 5 créneaux, 6 tables, 15 MJ, 31 scénarios, dont 28 programmés (2 doubles) et 3 en réserve. Puis chaque téléphone arrive : ouverture, code de présence, saisie du pseudo, `link`, première lecture.

## Vérifier les types

```sh
pnpm install --ignore-workspace
pnpm --ignore-workspace typecheck
```
