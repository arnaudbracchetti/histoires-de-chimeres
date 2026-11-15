# Test de charge de l'API

Scripts k6 du [plan de test de charge](../docs/load-test/plan.md). Ce dossier ne fait pas partie du workspace pnpm.

## Prérequis

- k6 2.x installé sur le poste (apt ou binaire des releases de `grafana/k6`).
- `pnpm build` à la racine : les scripts importent `packages/contract/dist/index.js`.
- `cp .env.example .env`, puis y mettre les identifiants de l'Organisateur de test2.
- Une base de test2 remise à zéro : la préparation refuse une convention qui a déjà des créneaux ou des tables.

## Lancer un palier

```sh
load-test/run.sh 80        # 80 téléphones, push à 0 ms
load-test/run.sh 80 300    # push qui répond en 300 ms
```

Le script demande une confirmation tapée, remet la base de test2 à zéro, la relance avec `fake-push` (`docker-compose.load-test.yml`), ouvre le tunnel SSH, collecte les mesures du serveur et lance k6. À la fin, ou sur Ctrl-C, il relance test2 dans sa configuration normale. Détail : en-tête de `run.sh` et [plan § 8](../docs/load-test/plan.md#8-lancer-une-campagne).

`setup()` connecte l'Organisateur, puis crée la convention du jour : 5 créneaux, 6 tables, 15 MJ, 31 scénarios, dont 28 programmés (2 doubles) et 3 en réserve. Puis chaque téléphone arrive : ouverture, code de présence, saisie du pseudo, `link`, abonnement au push, première lecture.

## Lancer k6 seul, pour la mise au point

Sur une base de test2 déjà remise à zéro, sans `fake-push` (les téléphones ne s'abonnent pas au push) :

```sh
set -a; . ./.env; set +a
k6 run k6/load-test.ts
```

## Le faux service de push

`fake-push/` : un script Node sans dépendance, et son Dockerfile. Il fabrique les abonnements, déchiffre chaque message reçu et compte les lisibles. Port d'envoi en https (8443, réseau Docker de test2 seulement), port d'administration en http (8081 dans le conteneur, publié en 9230 sur le `127.0.0.1` du serveur) : `POST /subscriptions`, `GET /stats`, `POST /reset`, `GET /health`.

## Vérifier les types et tester fake-push

```sh
pnpm install --ignore-workspace
pnpm --ignore-workspace typecheck
pnpm --ignore-workspace test
```
