# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

Monorepo pnpm (Node 22, pnpm 12). Depuis la racine :

- `pnpm dev:db` : PostgreSQL de dev dans Docker (port 5435). Avant le premier lancement : `cp apps/api/.env.example apps/api/.env`, puis `pnpm prisma:migrate` et `pnpm prisma:seed`.
- `pnpm dev` : compile les packages puis lance en parallèle leur watch, l'API (:3000), le front office (:4200) et le back office (:4201/gestion/). Les fronts passent par un proxy `/api` → :3000. L'API ne redémarre pas quand un package change : relancer `pnpm dev`.
- `pnpm build`, `pnpm test`, `pnpm lint` : tous les paquets, dans l'ordre des dépendances.
- Un seul fichier de test :
  - packages et API (Vitest) : `pnpm --filter api test -- src/convention/http/convention.controller.spec.ts` ;
  - fronts (`ng test`) : `pnpm --filter front-office test --include src/app/app.spec.ts`, sans `--`.
- `pnpm --filter api test:e2e` : application complète contre la base de dev.
- `pnpm --filter api exec prisma migrate dev --name <nom>` : nouvelle migration.
- `docker compose up --build app` : image de production en local sur :8080.
- `pnpm test:e2e` : tests Playwright (`e2e/`) contre l'image sur :8080, démarrée par Playwright si elle ne tourne pas. Ils couvrent les deux fronts, le service worker et le mode hors ligne. La base doit contenir la convention (`pnpm prisma:seed`). Si le navigateur manque : `pnpm --filter e2e exec playwright install chromium`.

Pièges :

- TypeScript reste en 6.0 (catalog de `pnpm-workspace.yaml`), car Angular 22 exige `>=6.0 <6.1`.
- Le client Prisma est généré dans `apps/api/src/generated/` (ignoré par git). Les scripts `pre*` de l'API lancent `prisma generate`. `prisma migrate dev` ne le régénère pas : après un changement de schéma, lancer `pnpm --filter api exec prisma generate` avant le seed.
- Un jeton d'injection (`Symbol`) vit dans son propre fichier (`<module>/<port>.token.ts`). S'il est défini dans `<module>.module.ts`, l'import circulaire module ↔ controller le rend `undefined` au moment du décorateur.
- pnpm bloque les scripts d'installation non listés dans `allowBuilds` (`pnpm-workspace.yaml`).

## Organisation du code (DDD)

| Chemin | Rôle | Peut dépendre de |
|---|---|---|
| `packages/domain` | Agrégats, entités, value objects | rien |
| `packages/application` | Commandes, ports (`<Concept>Reader`, `<Aggregate>Repository`) | `domain`, `contract` |
| `packages/contract` | DTO de l'API et descripteurs de ses endpoints (`<concept>Endpoints.<action>`) | rien |
| `apps/api` | NestJS : controllers (`<module>/http/`), implémentations Prisma des ports (`<module>/persistence/`), câblage (`<module>.module.ts`) | tout |
| `packages/design` | Identité commune aux fronts : jetons CSS, polices, sprites SVG, icônes de PWA, `initialOf` ([ADR 0006](docs/adr/0006-interface-sans-bibliotheque-de-composants.md)) | rien |
| `apps/front-office`, `apps/back-office` | Angular, CDK et Aria, CSS natif, sans bibliothèque de composants | `contract`, `design` |

- La frontière est physique : un package ne voit que les dépendances de son `package.json`. `domain` et `application` restent sans framework, donc sans décorateur Nest. L'API injecte chaque port par un jeton `Symbol`, et construit les commandes par `useFactory`.
- **Lecture** : le controller appelle directement un port `<Concept>Reader` (dans `application`), qui renvoie un DTO du `contract` ou `null` (→ 404 dans le controller). Exemple : `ConventionReader`. Une classe de requête n'existe que pour une vraie logique de lecture : combiner plusieurs ports, ou demander un verdict à un agrégat.
- **Endpoint** : déclaré une fois dans `contract` par `endpoint<Dto>(méthode, chemin)`, regroupé par concept (`conventionEndpoints.read`) ; la clé reprend le verbe du glossaire. Le controller en tire son chemin (`@Controller()` vide, `@Get(conventionEndpoints.read.path)`) et son type de retour (`ResponseOf<…>`), les fronts le lisent par `apiResource()` (`src/app/api-resource.ts`) et y écrivent par `apiCall()`. Les paramètres de chemin s'écrivent `:param`. Aucune route ni `/api` en dur dans le code TypeScript ([ADR 0004](docs/adr/0004-descripteurs-d-endpoints-dans-contract.md)).
- **Commande** : une classe dans `application` charge l'agrégat par un `<Aggregate>Repository`, lui délègue la règle, le sauvegarde. Le domaine refuse par une exception typée (un code de `contract` et des paramètres, sans texte). Un filtre global de l'API la traduit en Problem Details, avec le message français de son catalogue, et le controller ne fait aucun `try/catch` ([ADR 0008](docs/adr/0008-le-domaine-donne-un-code-l-api-ecrit-le-message.md)).
- **Règle** : elle vit en entier sur l'objet qui détient l'état. Une méthode ne reçoit jamais la condition de son propre refus (un booléen calculé par l'appelant) ; si une donnée est hors de l'agrégat, elle reçoit le collaborateur entier et l'interroge elle-même ([ADR 0005](docs/adr/0005-une-regle-vit-sur-l-objet-qui-recoit-ses-collaborateurs.md)).
- Pour concevoir un agrégat ou placer une règle métier, utiliser le skill `ddd`. Choix de cette organisation : [ADR 0002](docs/adr/0002-domaine-et-application-en-packages-sans-framework.md).

## Déploiement

Une seule image (`Dockerfile`), sur le modèle d'Agilometre (`/home/arnaud/projets/agilometre`). NestJS y sert le front office sur `/`, le back office sur `/gestion/` et l'API sur `/api`. Le service worker du front office a pour scope `/` : son `ngsw-config.json` exclut `/gestion` et `/api` de ses `navigationUrls`.

En production (`docker-compose.prod.yml`), le serveur a un Caddy « edge » mutualisé. Il reçoit `histoires-de-chimeres.caddy`, dans lequel `__PUBLIC_DOMAIN__` est remplacé par `sed`. Les migrations Prisma s'appliquent au démarrage du conteneur.

## Documents de référence

- `GLOSSARY.md` : le langage ubiquitaire, en français avec le terme anglais du code (Créneau · `TimeSlot`). À lire avant de nommer quoi que ce soit du domaine (code, textes d'interface, docs). Les termes listés en _Avoid_ sont exclus : employer le terme canonique, et n'inventer aucune autre traduction.
- `docs/prd.md` : le besoin. Les exigences portent un identifiant (ID-1, PR-5, TI-4…) à citer dans les tests, les commits et les échanges. Le §7 liste ce qui est hors V1. Le §8 liste les points ouverts : les soumettre à l'utilisateur au lieu de les trancher.
- `docs/design/` : la charte d'IHM (identité, jetons, ton, patterns du back office, écriture du CSS). À lire avant d'écrire un écran, un composant ou un texte d'interface.
- `docs/adr/` : les décisions d'architecture, nommées `NNNN-slug.md`. Le format et les critères pour proposer un ADR se trouvent dans le skill `domain-modeling`.

## Conventions

Langues ([ADR 0003](docs/adr/0003-code-en-anglais-glossaire-bilingue.md)) :

- **Anglais** : le code. Identifiants, fichiers et dossiers, packages, tables et colonnes, champs JSON, routes de l'API. Les concepts du domaine prennent le terme anglais du glossaire (`TimeSlot`, `Game`, `Draw`, `signUp()`).
- **Français** : commentaires, intitulés de tests, messages de commit, documentation, et tout ce que voit l'utilisateur (interface, notifications, messages d'erreur, URL comme `/gestion/`).

## Architecture cible

- **Front office** : PWA mobile pour les participants et les MJ, avec push web (service worker, clés VAPID). Sur place, seul le réseau 4G/5G est disponible : pages légères, et programme et affectations consultables hors ligne. Sur iPhone, le push n'est possible qu'après ajout à l'écran d'accueil (iOS 16.4+).
- **Back office** : sur ordinateur. Les MJ y saisissent leurs scénarios et leurs disponibilités avant la convention. Les Organisateurs y font tout le reste, y compris le pilotage du jour J.

Points structurants, répartis entre plusieurs documents :

- **Identité remplaçable** (ADR 0001) : le système identifie un participant par un identifiant interne ; le pseudo n'est qu'un nom affiché. Le mécanisme pseudo + code de récupération doit pouvoir être remplacé (par des badges QR, par exemple) sans toucher au reste du domaine.
- **Une personne, un compte** : un MJ est aussi un participant, et une même personne peut être MJ et Organisateur. Son code MJ lui sert aussi de code de récupération.
- **Cycle de vie d'un créneau** : inscriptions ouvertes → tirage lancé (inscriptions fermées) → résultat provisoire, ajustable → publication (résultat figé). Programmer une partie depuis la réserve annule le tirage provisoire et rouvre les inscriptions du créneau (TI-6).
- **Le tirage** est le cœur du métier. Il obéit à un ordre de priorités strict (TI-4), et une partie double est tirée avec son premier créneau (TI-3).
- **Pas de donnée nominative côté participant** : seuls les emails des MJ et des Organisateurs sont stockés, et ils ne servent qu'aux liens magiques du back office.

## Agent skills

### Issue tracker

Les issues vivent dans GitHub Issues (`arnaudbracchetti/histoires-de-chimeres`), via le CLI `gh`. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq labels canoniques, tels quels : `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Voir `docs/agents/triage-labels.md`.

### Domain docs

Single-context : `GLOSSARY.md` et `docs/adr/` à la racine. Voir `docs/agents/domain.md`.
