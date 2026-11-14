# Lint, tests et e2e HTTP dans GitHub Actions, avant l'image ghcr

Recherche du ticket [#187](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/187), sous-issue de #184, qui bloque #188. Ce document expose des faits et leurs sources. Il ne tranche rien : les choix restent listés en fin de document.

**Question** : comment faire passer `pnpm lint`, `pnpm test` et `pnpm --filter api test:e2e` dans GitHub Actions (Node 22, pnpm 12, PostgreSQL), avant de construire et publier l'image `ghcr.io/arnaudbracchetti/histoires-de-chimeres-app` ? Durée, caches, quotas, pièges.

Faits relevés le 14 novembre 2026. Les sources sont numérotées en fin de document. Les mesures locales ont été faites le même jour sur le poste de dev (WSL2, 6 cœurs), avec `taskset -c 0-3` pour simuler les 4 cœurs d'un runner public.

## Synthèse

- **Le dépôt est public** (`gh repo view --json visibility` → `PUBLIC`). Les runners standard y sont **gratuits, sans quota de minutes** [1], et ont **4 vCPU, 16 Go de RAM** [2]. Un dépôt privé aurait 2 vCPU, 8 Go, et 12 $ de crédit par mois sur le plan Free (soit 2 000 minutes Linux à 0,006 $) [1][2].
- **ghcr est gratuit pour un paquet public**, et le stockage d'images est gratuit pour l'instant, avec un préavis d'un mois avant tout changement [3]. Une image publiée pour la première fois est **privée par défaut** [4].
- **Actions à jour** (dernières versions publiées, lues sur l'API GitHub) : `actions/checkout@v7` (7.0.1), `actions/setup-node@v7` (7.1.0), `pnpm/action-setup@v6` (6.1.1), `docker/setup-buildx-action@v4` (4.4.1), `docker/login-action@v4` (4.8.0), `docker/metadata-action@v6` (6.2.0), `docker/build-push-action@v7` (7.4.0). Le modèle d'Agilometre est en retard : `checkout@v4`, `setup-node@v4`, `action-setup@v4` avec pnpm 10, `build-push-action@v6`.
- **pnpm 12** : `pnpm/action-setup@v6` le prend en charge. Il lit `packageManager` (`pnpm@12.6.0`) si l'on omet `version`, et **échoue** si les deux sont donnés et diffèrent [5][6].
- **Aucun `.env` n'est nécessaire** : la suite HTTP pose elle-même `DATABASE_URL` et `PUBLIC_URL` (`apps/api/test/setup.ts`), et `global-setup.ts` passe `DATABASE_URL` à `prisma migrate deploy`. Seul `TEST_DATABASE_URL` est à fournir, vers le service PostgreSQL.
- **Durée mesurée** (4 cœurs simulés) : lint 3 s, `pnpm test` 39 s, e2e HTTP 121 s (511 tests, 4 workers). Avec l'installation et la construction des packages, le job de vérification devrait tenir en **4 à 5 minutes**. Le build Docker n'a pas été mesuré en CI.
- **Ordre imposé** : construire les packages et générer le client Prisma **avant** `pnpm lint` (oxlint `--type-aware` sur l'API lit les types de `dist/` et de `src/generated/`) et avant `pnpm test` (les fronts importent `@chimeres/design` par son `dist/`).
- **Caches** : store pnpm par `pnpm/action-setup` (`cache: true`) ; couches Docker par `cache-from/cache-to: type=gha` avec Buildx. Limite de 10 Go par dépôt, entrées effacées après 7 jours sans accès [7][8].

## 1. Ce que le dépôt impose

Lu dans le dépôt le 14 novembre 2026.

| Élément | Valeur | Fichier |
|---|---|---|
| pnpm | `pnpm@12.6.0` | `package.json` (`packageManager`) |
| Node | `^22.22.3 \|\| >=24.15.0` | `package.json` (`engines`) |
| Scripts de build autorisés | `@prisma/engines`, `prisma`, `esbuild` ; refusés : `@parcel/watcher`, `lmdb`, `msgpackr-extract` | `pnpm-workspace.yaml` (`allowBuilds`) |
| `pnpm lint` | `pnpm -r lint && pnpm lint:naming` ; l'API lance `oxlint --type-aware src/ test/` | `package.json`, `apps/api/package.json` |
| `pnpm test` | `pnpm -r test` ; l'API a un `pretest: prisma generate` ; les fronts lancent `ng test --watch=false` | idem |
| Tests des fronts | builder `@angular/build:unit-test`, Vitest + `jsdom`, sans option `browsers` | `apps/*/angular.json`, `apps/*/package.json` |
| Suite HTTP | `vitest run --config ./vitest.config.e2e.ts`, `maxWorkers = TEST_WORKERS ?? availableParallelism()` | `apps/api/vitest.config.e2e.ts`, `apps/api/test/database.ts` |
| Bases de test | `TEST_DATABASE_URL` (défaut `postgresql://chimeres:chimeres@localhost:5435/chimeres_test?schema=public`), suffixée `_1` à `_N` ; `migrate deploy` crée celles qui manquent | `apps/api/test/database.ts`, `global-setup.ts` |
| PostgreSQL de dev | `postgres:17-alpine`, utilisateur et mot de passe `chimeres` | `docker-compose.yml` |
| Image | `ghcr.io/arnaudbracchetti/histoires-de-chimeres-app:${IMAGE_TAG:-latest}` | `docker-compose.prod.yml` |
| Workflows | aucun dossier `.github/` | - |

Le paquet `e2e` (Playwright) n'a ni `lint` ni `test` : `pnpm -r test` ne lance pas Playwright. L'installation récupère le paquet `playwright`, sans navigateur.

## 2. Installer pnpm 12 et Node 22

### 2.1 pnpm

- `pnpm/action-setup` : « This action supports pnpm v12 and earlier » [5]. La v6 est la dernière (6.1.1, 3 novembre 2026).
- `version` est optionnel quand `package.json` déclare `packageManager` [5]. Le code de l'action lève une erreur si les deux sont présents et diffèrent : « Multiple versions of pnpm specified » [6]. Le dépôt ayant `packageManager`, **ne pas passer `version`**.
- `cache: true` met en cache le store de pnpm, avec le hash de `pnpm-lock.yaml` comme clé [5]. L'action fait elle-même le `pnpm store prune` en fin de job [5].
- Pour pnpm 12, l'option `standalone` n'a plus d'effet : « the plain `pnpm` package already installs a standalone native executable » [5]. pnpm n'a donc pas besoin de Node pour s'installer.
- Alternative : `pnpm/setup` installe pnpm (v11 et plus) et Node en une étape, et lance `pnpm install` par défaut [5]. Sa dernière version est la v3.2.0 (12 novembre 2026), alors que l'exemple du README d'`action-setup` cite encore `pnpm/setup@v1`. Non essayée ici.

### 2.2 Node

- `actions/setup-node@v7` (7.1.0, 8 octobre 2026). Nouveauté de la v7 : passage interne en ESM, sans changement d'entrées ni de sorties ; suppression du `NODE_AUTH_TOKEN` factice, qui ne concerne que la publication npm [9].
- Depuis la v6, le cache n'est automatique que pour npm ; pour pnpm, il faut `cache: pnpm`, et pnpm doit déjà être installé [9]. Inutile si `pnpm/action-setup` a `cache: true` : un seul des deux suffit.
- `node-version: 22` prend la dernière 22.x. Au 11 novembre 2026, c'est la 22.23.5 [10], compatible avec `^22.22.3`. Node 22 est en maintenance depuis le 21 octobre 2025, jusqu'au 30 avril 2027 ; Node 24 l'est depuis le 20 octobre 2026, jusqu'au 30 avril 2028 [11].

### 2.3 Installation

- `pnpm install` est en `--frozen-lockfile` par défaut en CI, dès qu'un lockfile existe [12]. GitHub Actions pose `CI=true`.
- `strictDepBuilds` vaut `true` par défaut : un paquet dont le script de build n'est pas tranché dans `allowBuilds` fait échouer l'installation avec `ERR_PNPM_IGNORED_BUILDS` [13]. Le build Docker fait déjà `pnpm install --frozen-lockfile` avec le même lockfile : une installation qui passe dans le Dockerfile passera en CI, et inversement. Tout nouveau paquet à script devra être ajouté à `allowBuilds` avant de pousser.

## 3. PostgreSQL en service

GitHub documente un service `postgres` avec un healthcheck `pg_isready` (intervalle 10 s, délai 5 s, 5 essais) et un port 5432 publié sur l'hôte. Quand les étapes tournent directement sur le runner (pas dans un conteneur de job), on joint le service par `localhost` et le port de l'hôte [14]. Les services exigent un runner Linux [14].

Pour ce dépôt :

- image `postgres:17-alpine`, comme `docker-compose.yml` ;
- `POSTGRES_USER` et `POSTGRES_PASSWORD` à `chimeres` : cet utilisateur est superutilisateur, donc `prisma migrate deploy` peut créer `chimeres_test_1` à `chimeres_test_4` ;
- `TEST_DATABASE_URL=postgresql://chimeres:chimeres@localhost:5432/chimeres_test?schema=public` ;
- `TEST_WORKERS` : inutile sur un runner public, `availableParallelism()` y donnera 4. Le fixer à 4 rend la durée indépendante d'un changement de runner. Sur un runner privé (2 vCPU), il descendrait à 2.

Le commentaire de `database.ts` prévient qu'au-delà d'un worker par cœur, l'API et PostgreSQL se disputent le processeur. Sur le runner, PostgreSQL partage les mêmes 4 vCPU que les workers : la mesure locale avec `taskset` ne bornait que Vitest, pas PostgreSQL. La durée réelle sur le runner peut donc dépasser les 121 s mesurées. **Non vérifié.**

## 4. Variables

| Variable | Nécessaire en CI ? | Raison |
|---|---|---|
| `TEST_DATABASE_URL` | oui | sinon la suite vise `localhost:5435` |
| `TEST_WORKERS` | non (conseillé : 4) | défaut : nombre de cœurs |
| `DATABASE_URL` | non | `setup.ts` la pose par worker ; `global-setup.ts` la passe à `migrate deploy` ; `prisma generate` s'en passe (`prisma.config.ts`) |
| `PUBLIC_URL` | non | `setup.ts` pose `https://chimeres.example.org` si elle manque |
| `VAPID_*` | non | la suite utilise `fake-push-service.ts` |
| `ORGANIZER_PSEUDO`, `ORGANIZER_PASSWORD` | non | les tests insèrent leurs sessions (`test/account-session.ts`) |

`dotenv/config` n'est importé que par `src/main.ts` et `prisma.config.ts`. Vérifié en local : la suite HTTP passe avec `DOTENV_CONFIG_PATH=/nonexistent` (le `.env` n'est pas lu), `CI=true` et 4 workers.

Aucun secret n'est nécessaire au job de vérification. La publication sur ghcr se fait avec `GITHUB_TOKEN`.

## 5. Durée attendue

Mesures locales du 14 novembre 2026, packages déjà installés :

| Étape | 6 cœurs | 4 cœurs (`taskset`) |
|---|---|---|
| `pnpm build:packages` + `prisma generate` | 3 s | - |
| `pnpm lint` | 1 s | 3 s |
| `pnpm test` (`CI=true` à 4 cœurs) : 2 041 tests, dont 192 front office et 370 back office | 24 s | 39 s |
| `pnpm --filter api test:e2e` : 25 fichiers, 511 tests | 79 s | 121 s |
| `pnpm build` complet (fronts compris) | 14 s | - |

Non mesuré : `pnpm install` sur le runner (avec et sans cache), le démarrage du service PostgreSQL, le build Docker sur le runner. Estimation, sans source : 4 à 5 minutes pour le job de vérification, quelques minutes de plus pour l'image, moins quand le cache `gha` couvre les étapes `deps` et `prod-deps` du Dockerfile.

## 6. Cache pnpm et cache Docker

### 6.1 Cache GitHub

- 10 Go par dépôt par défaut ; une entrée non lue depuis plus de 7 jours est effacée [7].
- Un run lit les caches de sa branche et de la branche par défaut ; une pull request lit aussi ceux de sa branche de base ; les caches créés par une PR ne servent qu'à cette PR [7].

### 6.2 Docker

- `docker/build-push-action@v7` avec `cache-from: type=gha` et `cache-to: type=gha,mode=max` ; l'action remplit seule `url` et `token` [8].
- Le pilote `docker` par défaut n'exporte ce cache qu'avec le magasin d'images containerd [8]. `docker/setup-buildx-action` crée un builder `docker-container`, « not required but recommended […] to be able to build multi-platform images, export cache, etc. » [15].
- Depuis le 15 avril 2025, seule l'API v2 du service de cache existe ; il faut Buildx 0.21 et BuildKit 0.20 au minimum [16]. Les versions actuelles des actions remplissent cette condition.
- `mode=max` exporte aussi les étapes intermédiaires (`deps`, `prod-deps`, `build`), utiles ici : `deps` et `prod-deps` ne dépendent que des manifestes et du lockfile. Le scope par défaut est `buildkit` : chaque build écrase le cache du précédent [8].
- Sans `actions/checkout`, `build-push-action` construit depuis le contexte Git du commit [15]. Agilometre fait un checkout puis `context: .` : les deux marchent.

## 7. Publication sur ghcr

- Permissions du `GITHUB_TOKEN` : `contents: read`, `packages: write` ; `attestations: write` et `id-token: write` seulement pour une attestation de provenance [17].
- Connexion : `docker/login-action` avec `registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}` [17].
- Une image publiée par un workflow avec `GITHUB_TOKEN` est liée automatiquement au dépôt du workflow. Si une image du même nom a déjà été poussée sans lien avec le dépôt, `GITHUB_TOKEN` n'a pas le droit de la pousser [4].
- Première publication : visibilité **privée** [4]. Pour que le serveur tire l'image sans identifiant, il faudra la passer en publique dans les réglages du paquet, ou faire `docker login ghcr.io` sur le serveur.
- `docker/metadata-action` produit les tags et les labels OCI [17].

**Non vérifié** : l'existence d'un paquet `histoires-de-chimeres-app` sur ghcr. L'API répond 404, mais le jeton de `gh` n'a pas le scope `read:packages` (403 sur le paquet d'Agilometre), donc ce 404 ne prouve rien. `scripts/deploy-test.sh` indique que l'image ne passe pas par ghcr aujourd'hui.

## 8. Pièges

1. **Lint avant build** : oxlint `--type-aware` sur l'API résout `@chimeres/*` par leur `dist/` et le client Prisma par `src/generated/`. Sur un checkout neuf, lancer d'abord `pnpm build:packages` puis `pnpm --filter api exec prisma generate`. En local, le lint passait parce que ces dossiers existaient déjà. L'échec sur checkout neuf n'a pas été reproduit, c'est une déduction des `exports` de `packages/*/package.json` (`./dist/index.d.ts`).
2. **Tests des fronts avant build** : même cause, `@chimeres/design` et `@chimeres/contract` sont lus par `dist/`.
3. **`ng test` en CI** : déjà headless. Le builder lance Vitest dans Node avec `jsdom` ; le mode navigateur ne s'active qu'avec l'option `browsers` [18], absente des `angular.json`. `ng test` détecte `CI=true` et passe en exécution unique [18] ; les scripts ont déjà `--watch=false`. Aucun navigateur à installer.
4. **`prisma generate`** : `prisma migrate dev` ne le lance pas (CLAUDE.md), mais `pretest` de l'API le fait. La suite HTTP (`test:e2e`) n'a pas de `pre` : elle compte sur un client déjà généré, d'où l'étape explicite du point 1.
5. **`allowBuilds`** : voir 2.3. `sharp` n'y figure pas ; il installe des binaires précompilés et l'installation passe déjà dans Docker.
6. **Version de pnpm en double** : ne pas recopier `version: 10` d'Agilometre, l'action échouerait contre `packageManager` [6].
7. **Port** : le service publie 5432, pas 5435 ; d'où `TEST_DATABASE_URL`.
8. **Image privée** à la première publication (section 7).
9. **Build en double** : le job de vérification construit déjà les packages, et le Dockerfile reconstruit tout. C'est le prix de jobs séparés ; le cache `gha` réduit le surcoût côté Docker.

## 9. Esquisse de workflow

Esquisse non essayée, à adapter. Un seul fichier, deux jobs : `verify` sur chaque push et PR, `image` seulement sur `main`. Les déclencheurs et les tags sont des choix ouverts (section 10).

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: chimeres
          POSTGRES_PASSWORD: chimeres
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U chimeres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      TEST_DATABASE_URL: postgresql://chimeres:chimeres@localhost:5432/chimeres_test?schema=public
      TEST_WORKERS: 4
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6 # version lue dans packageManager
        with:
          cache: true
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: pnpm install
      - run: pnpm build:packages
      - run: pnpm --filter api exec prisma generate
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm --filter api test:e2e

  image:
    needs: verify
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      packages: write
    steps:
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/arnaudbracchetti/histoires-de-chimeres-app
          tags: |
            type=sha
            type=raw,value=latest
      - uses: docker/build-push-action@v7 # contexte Git, sans checkout
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## 10. Points ouverts, à trancher par l'utilisateur

- **Déclencheur de publication** : chaque push sur `main` (comme ci-dessus), ou des tags `v*.*.*` comme Agilometre.
- **Tags de l'image** : `sha-xxxxxxx` + `latest`, numéros de version, ou les deux. `docker-compose.prod.yml` lit `IMAGE_TAG`, `latest` par défaut.
- **Visibilité du paquet ghcr** : publique (tirage sans identifiant) ou privée (login sur le serveur).
- **Versions d'actions** : par tag majeur (`@v7`) ou par SHA, comme le tutoriel GitHub [17].
- **`pnpm/action-setup` + `setup-node`, ou `pnpm/setup` seul.**
- **Suite Playwright** (`pnpm test:e2e`) : hors du périmètre du ticket, non étudiée.

## Ce qui n'a pas été vérifié

- Aucun workflow n'a tourné sur GitHub : les durées viennent du poste local, CPU bornés par `taskset` pour Vitest seul.
- L'échec du lint et des tests de front sur un checkout sans `dist/` est déduit, pas reproduit.
- Le temps d'installation et le gain du cache pnpm sur le runner.
- La durée du build Docker sur le runner, avec et sans cache `gha`.
- L'existence et la visibilité actuelles du paquet ghcr (scope `read:packages` manquant).
- Le comportement exact de `pnpm/setup@v3`.

## Sources

Toutes consultées le 14 novembre 2026.

1. GitHub Docs, « GitHub Actions billing » : https://docs.github.com/en/billing/concepts/product-billing/github-actions
2. GitHub Docs, « GitHub-hosted runners reference » : https://docs.github.com/en/actions/reference/runners/github-hosted-runners
3. GitHub Docs, « GitHub Packages billing » : https://docs.github.com/en/billing/concepts/product-billing/github-packages
4. GitHub Docs, « Working with the Container registry » : https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
5. `pnpm/action-setup`, README (branche `master`) : https://github.com/pnpm/action-setup
6. `pnpm/action-setup`, `src/install-pnpm/run.ts`, l. 162-171 : https://github.com/pnpm/action-setup/blob/master/src/install-pnpm/run.ts
7. GitHub Docs, « Dependency caching reference » : https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
8. Docker Docs, « GitHub Actions cache » : https://docs.docker.com/build/cache/backends/gha/
9. `actions/setup-node`, README : https://github.com/actions/setup-node
10. Node.js, index des versions : https://nodejs.org/dist/index.json
11. `nodejs/Release`, `schedule.json` : https://github.com/nodejs/Release/blob/main/schedule.json
12. pnpm, « pnpm install » (`--frozen-lockfile`) : https://pnpm.io/cli/install
13. pnpm, « Build settings » (`allowBuilds`, `strictDepBuilds`) : https://pnpm.io/settings/build
14. GitHub Docs, « Creating PostgreSQL service containers » : https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers
15. `docker/build-push-action`, README : https://github.com/docker/build-push-action
16. Docker Docs, « Cache management with GitHub Actions » (source : `docker/docs`, `content/manuals/build/ci/github-actions/cache.md`) : https://docs.docker.com/build/ci/github-actions/cache/
17. GitHub Docs, « Publishing Docker images » : https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
18. Angular, « Testing » : https://angular.dev/guide/testing

Versions des actions : API GitHub `repos/<owner>/<repo>/releases/latest`, lue le 14 novembre 2026.
