# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Règles de travail

- Ne rien commiter sans l'accord explicite de l'utilisateur, même si un skill le demande.
- Répondre court et concis, avec des mots simples et clairs. Pas de tournures de style.

## Commandes

Monorepo pnpm (Node 22, pnpm 12). Depuis la racine :

- `pnpm dev:db` : PostgreSQL de dev dans Docker (port 5435). Avant le premier lancement : `cp apps/api/.env.example apps/api/.env`, puis `pnpm prisma:migrate`. La migration `default_convention` crée la convention, avec son nom provisoire, dans toute base qui n'en a pas. Le seed (`pnpm prisma:seed`) ne fait rien en attendant le seed de démonstration.
- `pnpm dev` : compile les packages puis lance en parallèle leur watch, l'API (:3000), le front office (:4200) et le back office (:4201/gestion/). Les fronts passent par un proxy `/api` → :3000. L'API ne redémarre pas quand un package change : relancer `pnpm dev`.
- `pnpm build`, `pnpm test`, `pnpm lint` : tous les paquets, dans l'ordre des dépendances.
- Un seul fichier de test :
  - packages et API (Vitest) : `pnpm --filter design test -- src/initial-of.spec.ts` ;
  - suite HTTP de l'API : `pnpm --filter api test:e2e -- src/convention/http/convention.controller.e2e-spec.ts` ;
  - fronts (`ng test`) : `pnpm --filter front-office test --include src/app/app.spec.ts`, sans `--`.
- `pnpm --filter api test:e2e` : application complète, par HTTP, contre la base de test `chimeres_test` (même serveur PostgreSQL que la dev, `TEST_DATABASE_URL` pour en changer). La suite la crée et la migre au démarrage (`test/global-setup.ts`), la remet à zéro avant chaque test (`test/database.ts`) et exécute ses fichiers en série. Les controllers s'y testent sans port bouchonné (`*.e2e-spec.ts`, à côté du controller).
- `pnpm --filter api exec prisma migrate dev --name <nom>` : nouvelle migration.
- `docker compose up --build app` : image de production en local sur :8080.
- `scripts/deploy-test.sh` : déploie l'état courant du dépôt, non commité compris, sur le serveur de test `test2.nekbet.fr`. L'image est construite sur le poste puis copiée par SSH, sans passer par ghcr. Le script attend le « healthy », revient à la version précédente en cas d'échec, et garde sur le serveur l'image courante et la précédente.
- `pnpm test:e2e` : tests Playwright (`e2e/`) contre l'image du service `app-e2e` sur :8081, démarrée par Playwright si elle ne tourne pas. Elle pointe vers la base `chimeres_e2e`, créée et migrée au démarrage du conteneur : aucun seed n'est nécessaire. Projet `mobile` (Pixel 7) pour `tests/front-office/`, projet `bureau` (1280 × 800) pour `tests/back-office/`. Le projet `mobile` passe après `bureau`, dont la remise à zéro effacerait ses pseudos ; `--project mobile --no-deps` le lance seul. Sa base n'est jamais remise à zéro : chaque test prend des pseudos qui lui sont propres. Les tests du bureau importent `test` de `e2e/fixtures.ts`, qui remet la base e2e à zéro avant chacun, et s'exécutent en série. Les données se préparent par l'API, à travers les descripteurs de `contract` : aucune route en dur. Si le navigateur manque : `pnpm --filter e2e exec playwright install chromium`.

Pièges :

- TypeScript reste en 6.0 (catalog de `pnpm-workspace.yaml`), car Angular 22 exige `>=6.0 <6.1`.
- Le client Prisma est généré dans `apps/api/src/generated/` (ignoré par git). Les scripts `pre*` de l'API lancent `prisma generate`. `prisma migrate dev` ne le régénère pas : après un changement de schéma, lancer `pnpm --filter api exec prisma generate` avant le seed.
- Un jeton d'injection (`Symbol`) vit dans son propre fichier (`<module>/<port>.token.ts`). S'il est défini dans `<module>.module.ts`, l'import circulaire module ↔ controller le rend `undefined` au moment du décorateur.
- pnpm bloque les scripts d'installation non listés dans `allowBuilds` (`pnpm-workspace.yaml`).
- `ng serve` ne pré-bundle pas `@chimeres/contract` ni `@chimeres/design` (`prebundle.exclude` de chaque `angular.json`). Sinon Vite en garde une copie périmée dans `.angular/cache` : un descripteur renommé dans `contract` y reste `undefined`, et l'appel échoue sans requête. En contrepartie, Vite résout les dépendances de `design` depuis le front : chaque front déclare donc aussi `marked` (`catalog:`).
- Les deux suites de bout en bout ne touchent jamais la base de dev. Leur remise à zéro vide toutes les tables (`apps/api/test/reset-database.sql`), puis rejoue la migration `default_convention`. Si la convention reçoit de nouvelles colonnes, cette migration reste la source de son état initial.
- Le code de présence vient de la valeur par défaut de sa colonne (`random_presence_code()`, migration `presence_code`) : l'`INSERT` de `default_convention` le reçoit sans le nommer. Il survit à la remise à zéro des bases de test (`restore-presence-code.sql`) : un test `mobile` qui l'a lu le garde valable, même si le projet `bureau` remet la base à zéro en parallèle.

## Organisation du code (DDD)

| Chemin | Rôle | Peut dépendre de |
|---|---|---|
| `packages/domain` | Agrégats, entités, value objects | rien |
| `packages/application` | Commandes, ports (`<Concept>Reader`, `<Aggregate>Repository`) | `domain`, `contract` |
| `packages/contract` | DTO de l'API et descripteurs de ses endpoints (`<concept>Endpoints.<action>`) | rien |
| `apps/api` | NestJS : controllers (`<module>/http/`), implémentations Prisma des ports (`<module>/persistence/`), câblage (`<module>.module.ts`) | tout |
| `packages/design` | Identité commune aux fronts : jetons CSS, polices, sprites SVG, icônes de PWA, typographie française, `initialOf`, `renderPresentation` ([ADR 0006](docs/adr/0006-interface-sans-bibliotheque-de-composants.md)) | `marked` |
| `apps/front-office`, `apps/back-office` | Angular, CDK et Aria, CSS natif, sans bibliothèque de composants | `contract`, `design` |

- **Pas de code en double entre le back office et le front office.** Deux copies finissent par diverger (« 1 500 » dans un front, « 1500 » dans l'autre). Avant d'écrire dans un front une logique que l'autre a déjà, la mettre en commun : sans framework, dans `packages/design` (typographie, heures et dates, rendu de la présentation, `initialOf`) ; pour l'API, dans `contract`. Une dépendance lourde y prend sa propre entrée (`@chimeres/design/presentation`), pour ne pas peser sur le chargement initial des fronts.
- La frontière est physique : un package ne voit que les dépendances de son `package.json`. `domain` et `application` restent sans framework, donc sans décorateur Nest. L'API injecte chaque port par un jeton `Symbol`, et construit les commandes par `useFactory`.
- **Lecture** : le controller appelle directement un port `<Concept>Reader` (dans `application`), qui renvoie un DTO du `contract`, ou `null` si l'élément peut manquer (→ 404 dans le controller). Exemple : `ConventionReader`, dont la convention existe toujours. Une classe de requête n'existe que pour une vraie logique de lecture : combiner plusieurs ports, ou demander un verdict à un agrégat.
- **Endpoint** : déclaré une fois dans `contract` par `endpoint<Dto>(méthode, chemin)`, regroupé par concept (`conventionEndpoints.read`) ; la clé reprend le verbe du glossaire. Le controller en tire son chemin (`@Controller()` vide, `@Get(conventionEndpoints.read.path)`) et son type de retour (`ResponseOf<…>`), les fronts le lisent par `apiResource()` (`src/app/api-resource.ts`) et y écrivent par `apiCall()`, obtenu par `injectApiCall()` (`src/app/api-call.ts`). Les paramètres de chemin s'écrivent `:param`. Aucune route ni `/api` en dur dans le code TypeScript ([ADR 0004](docs/adr/0004-descripteurs-d-endpoints-dans-contract.md)).
- **Commande** : une classe dans `application` charge l'agrégat par un `<Aggregate>Repository`, lui délègue la règle, le sauvegarde. Sur `Convention`, elle passe par `changeConvention()`, qui rejoue une fois sur une version périmée. Le domaine refuse par une exception typée (`Refusal` : un code et des paramètres, sans texte ; la carte des codes existe dans `domain` et dans `contract`, et `application` vérifie à la compilation qu'elles concordent). Le filtre global de l'API (`src/http/problem.filter.ts`) la traduit en Problem Details, avec le message français de son catalogue (`src/http/problem-catalogue.ts`), et le controller ne fait aucun `try/catch`. Un corps est vérifié par `@Body(new ZodBody(schema))` ([ADR 0008](docs/adr/0008-le-domaine-donne-un-code-l-api-ecrit-le-message.md)).
- **Règle** : elle vit en entier sur l'objet qui détient l'état. Une méthode ne reçoit jamais la condition de son propre refus (un booléen calculé par l'appelant) ; si une donnée est hors de l'agrégat, elle reçoit le collaborateur entier et l'interroge elle-même ([ADR 0005](docs/adr/0005-une-regle-vit-sur-l-objet-qui-recoit-ses-collaborateurs.md)).
- Pour concevoir un agrégat ou placer une règle métier, utiliser le skill `ddd`. Choix de cette organisation : [ADR 0002](docs/adr/0002-domaine-et-application-en-packages-sans-framework.md).

## Déploiement

Une seule image (`Dockerfile`), sur le modèle d'Agilometre (`/home/arnaud/projets/agilometre`). NestJS y sert le front office sur `/`, le back office sur `/gestion/` et l'API sur `/api`. Le service worker du front office a pour scope `/` : son `ngsw-config.json` exclut `/gestion` et `/api` de ses `navigationUrls`. À la différence d'Agilometre, l'image n'embarque que les dépendances de production de l'API (étape `prod-deps`, CLI Prisma comprise pour les migrations).

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

- **Identité remplaçable** (ADR 0009, qui remplace l'ADR 0001) : le système identifie un participant par un identifiant interne ; le pseudo n'est qu'un nom affiché. On s'identifie par son seul pseudo, sans secret, derrière le code de présence de la convention. Ce mécanisme doit pouvoir être remplacé (par des badges QR, par exemple) sans toucher au reste du domaine.
- **Une personne, un compte** (ADR 0012) : un MJ est aussi un participant, qui porte son pseudo, et une même personne peut être MJ et Organisateur. Sur le téléphone, saisir le pseudo d'un MJ le relie à ce MJ après une confirmation, sans code.
- **Cycle de vie d'un créneau** : inscriptions ouvertes → tirage lancé (inscriptions fermées) → résultat provisoire, ajustable → publication (résultat figé). Programmer une partie depuis la réserve annule le tirage provisoire et rouvre les inscriptions du créneau (TI-6).
- **Le tirage** est le cœur du métier. Il obéit à un ordre de priorités strict (TI-4), et une partie double est tirée avec son premier créneau (TI-3).
- **Pas de donnée nominative côté participant** : seuls les emails des MJ et des Organisateurs sont stockés, et ils ne servent qu'aux liens magiques du back office.
- **Notifications** (ADR 0010) : le geste du domaine les produit (un code, des paramètres, des pseudos destinataires), la commande les passe au port `NotificationSender` après la sauvegarde, et l'API écrit le texte puis envoie sans file.

## Agent skills

### Issue tracker

Les issues vivent dans GitHub Issues (`arnaudbracchetti/histoires-de-chimeres`), via le CLI `gh`. Voir `docs/agents/issue-tracker.md`.

### Triage labels

Les cinq labels canoniques, tels quels : `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Voir `docs/agents/triage-labels.md`.

### Domain docs

Single-context : `GLOSSARY.md` et `docs/adr/` à la racine. Voir `docs/agents/domain.md`.
