# Outil de test de charge : k6, Artillery, autocannon ou script Node maison

Recherche du ticket [#203](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/203), enfant de la carte #202 (tests de charge de l'API). Elle bloque #208.

**Question** : quel outil pour simuler 80 téléphones de la PWA et 2 ou 3 Organisateurs contre `test2.nekbet.fr`, depuis le poste (Linux sous WSL2) ?

Faits relevés le 15 novembre 2026, dans les dépôts GitHub (API `releases`), le registre npm, les docs officielles et le code du projet. Chaque fait renvoie à une source numérotée, listée en fin de document. Aucun des outils n'a été lancé pendant cette recherche : ce qui touche à l'exécution réelle (import de `contract` dans k6, en particulier) reste à vérifier par un essai.

## Synthèse

| Critère | k6 | Artillery | autocannon | Script Node maison |
|---|---|---|---|---|
| Dernière version | 2.4.0 (12/11/2026), 1.8.3 (13/11/2026) | 2.0.34 (14/08/2026) | 9.0.0 (06/11/2026) | Node 22 + `fetch` (undici) |
| Licence | AGPL-3.0 | MPL-2.0 | MIT | celle du projet |
| Réutiliser `contract` | oui, par le JS compilé (`dist/`) ou un bundle ; pas par `@chimeres/contract` | oui, processeur `.ts` mis en bundle par Artillery | oui (Node), mais l'outil ne s'y prête pas | oui, import direct et typé |
| Un cookie par utilisateur virtuel | oui, une boîte à cookies par VU, **vidée à chaque itération** par défaut | oui, « remembered and re-used by individual virtual users » | non : pas de boîte à cookies, un `context` par connexion | à écrire (`getSetCookie()`) |
| `Sec-Fetch-Site` / `Origin` | en-têtes libres par requête | `config.http.defaults.headers` | en-têtes libres | en-têtes libres (undici ne filtre pas) |
| Phases montée / plateau / pic | scénarios, exécuteurs, `startTime` | `phases` (`rampTo`, `arrivalRate`, `arrivalCount`, `pause`) | non : durée et nombre de connexions fixes | à écrire |
| p50 / p95 / p99, erreurs | oui (`med`, p95 par défaut ; p99 par `summaryTrendStats`), `http_req_failed` | min, max, mean, median, p95, p99 ; `http.codes.*`, `errors.*` | p50, p90, p97.5, p99 (pas de p95) ; `errors`, `non2xx` | `perf_hooks.createHistogram()` à brancher |
| Seuils qui font échouer le test | oui (`thresholds`, code de sortie) | oui (plugin `ensure`) | non | à écrire |
| Installation sur WSL2 | binaire Go, dépôt apt, image Docker | paquet npm, Node >= 22.18.0 | paquet npm | rien |

En bref : autocannon est un outil de benchmark d'un endpoint, sans notion d'utilisateur ; il ne répond pas au besoin. Les trois autres le peuvent. k6 donne le plus pour le moins de code ; Artillery reste dans l'écosystème Node mais pense en arrivées de nouveaux utilisateurs ; le script maison réutilise `contract` sans friction mais oblige à réécrire ce que les deux outils donnent.

## 0. Ce que le projet impose

- **Les descripteurs** : `endpoint<Res, Params, Body, Query>(method, path, { access })` renvoie un simple objet `{ method, path, access }` ; les types ne vivent que dans un champ fantôme. `apiUrl(endpoint, params)` construit `/api/<path>` en remplaçant chaque `:param` [P1]. Les descripteurs sont groupés par concept (`conventionEndpoints.read`, `linkedPhoneEndpoints.link`, `accountEndpoints.logIn`) [P2].
- **Le package `contract`** n'a aucune dépendance : ses sources n'importent que des fichiers voisins (`./endpoint.js`), et son `dist/` compilé (ESM, cible ES2023) ne contient aucun import nu [P3]. Seul `front-office.js` utilise `URLSearchParams`, à l'intérieur d'une fonction (`buildFrontOfficeUrl`), pas au chargement du module [P3].
- **Deux cookies de session** :
  - téléphone relié : `linked-phone`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api`, 30 jours [P4] ;
  - back office : `__Host-account-session` [P5].
  - Les deux sont `Secure` : le serveur de test doit être joint en HTTPS.
- **Garde CSRF** : une écriture (`POST`, `PUT`, `PATCH`, `DELETE`) passe si `Sec-Fetch-Site` vaut `same-origin`. Sans cet en-tête, `Origin` doit être égal à l'origine de `PUBLIC_URL` [P6]. Un client hors navigateur pose l'un ou l'autre.

## 1. k6 (Grafana)

### 1.1 Licence, maintenance

- Dépôt `grafana/k6`, licence AGPL-3.0, 32 000 étoiles, dernier push le 14/11/2026 [K1].
- Deux branches publiées en parallèle : v2 (2.0.0 le 11/05/2026, 2.1.0 le 30/06, 2.2.0 le 10/08, 2.3.0 le 21/09, 2.4.0 le 12/11/2026) et v1 en correctifs (1.8.0 le 08/06, 1.8.3 le 13/11/2026) [K1].
- La v2 retire surtout des commandes et options obsolètes (`k6 login`, exécuteur `externally-controlled`, `--no-summary`, résumé `legacy`) ; le serveur d'API HTTP de k6 ne démarre plus par défaut [K2]. Rien de ce qui sert ici (scénarios, `http`, seuils) n'est retiré.
- L'AGPL porte sur k6 lui-même. Utilisé comme outil, sans le modifier ni le distribuer, il ne touche pas le code du projet (lecture de la licence, pas un avis juridique).

### 1.2 Runtime et TypeScript

- Le moteur JS est Sobek, fork de goja maintenu par Grafana [K2]. Ce n'est pas Node.
- « k6 uses esbuild to transpile TypeScript (TS) code for all files that have the `.ts` extension. » Le support est partiel : « it strips the type information but doesn't provide type safety ». Actif par défaut depuis k6 0.57 [K3].
- Résolution des modules : « k6 adopts a browser-like module resolution and doesn't support Node.js module resolution ». « Although k6 does not resolve node modules, you can utilize a Bundler to load npm dependencies. » Les paquets qui s'appuient sur des API de Node (`os`, `fs`) ne fonctionnent pas [K4].
- `URL` et `URLSearchParams` : la doc les fait importer depuis `https://jslib.k6.io/url/1.0.0/index.js` [K5]. Aucune source officielle lue ne dit qu'ils sont des globales.

### 1.3 Réutiliser `contract` dans k6

Déduit des faits ci-dessus, **non essayé** :

- `import { conventionEndpoints } from '@chimeres/contract'` : refusé (spécificateur nu, pas de résolution Node) [K4].
- `import ... from '../packages/contract/src/index.ts'` : probablement refusé. `index.ts` importe `./account.js`, fichier qui n'existe qu'en `.ts` ; la transpilation fichier par fichier de k6 ne fait pas la correspondance `.js` → `.ts` que fait TypeScript en `nodenext` [K3][P3].
- `import ... from '../packages/contract/dist/index.js'` : devrait fonctionner. ESM, imports relatifs avec extension, aucune dépendance, aucun appel à une API de Node au chargement [P3]. Il faut `pnpm build` avant. `buildFrontOfficeUrl` (qui utilise `URLSearchParams`) n'est pas à appeler.
- Alternative sûre : un bundle ESM d'un seul fichier, produit par esbuild (`esbuild --bundle --format=esm`). esbuild 0.28.2 est déjà dans le lockfile, comme dépendance de Vite, pas en dépendance directe [P7]. C'est le chemin que la doc de k6 recommande pour toute dépendance externe [K4].
- Le typage : k6 n'en vérifie aucun [K3]. Pour garder `ParamsOf` et `BodyOf`, le script k6 en `.ts` se vérifie à part par `tsc --noEmit` avec `@types/k6` et les `.d.ts` de `contract/dist`.

### 1.4 Cookies, en-têtes, phases, mesures

- **Cookies** : « By default, k6 has a cookie jar for each VU » ; k6 gère seul la réception, le stockage et l'envoi [K6]. Mais la boîte est **vidée après chaque itération** : `noCookiesReset` (faux par défaut) « disables the default behavior of resetting the cookie jar after each VU iteration » [K7]. Deux façons de garder une session par téléphone : `noCookiesReset: true`, ou ouvrir les 80 sessions dans `setup()` et poser le cookie de chaque VU au début de chaque itération (`http.cookieJar().set(...)`).
- **En-têtes** : libres par requête (`params.headers`), donc `Sec-Fetch-Site: same-origin` ou `Origin` sur chaque écriture, par un petit enveloppement de `http.request` autour de `apiUrl()`.
- **Phases** : les scénarios « are independent from each other and run in parallel », et « can be made to appear sequential by setting the `startTime` property » [K8]. Exécuteurs : `ramping-vus` (montée, plateau par un palier de même cible), `constant-vus`, `constant-arrival-rate`, `ramping-arrival-rate`, `per-vu-iterations`, `shared-iterations` [K9]. Le pic : un scénario `per-vu-iterations` à 80 VUs et 1 itération, lancé par `startTime` ; ses VUs sont initialisés avant le départ du test [K10]. Aucune doc lue ne parle de barrière qui synchroniserait les VUs à la milliseconde : « quasi simultané » est le mieux garanti. Un scénario à part, de 2 ou 3 VUs, joue les Organisateurs.
- **Mesures** : par défaut le résumé de fin montre `avg, min, med, max, p(90), p(95)` ; `summaryTrendStats` ajoute `p(99)` [K7]. Le taux d'erreur est `http_req_failed` ; un seuil s'écrit `http_req_failed: ['rate<0.01']`, `http_req_duration: ['p(95)<200']` [K11]. Un seuil franchi fait échouer la commande.
- **Installation** : dépôt apt (Debian, Ubuntu), binaire depuis les releases GitHub, ou image Docker `grafana/k6` [K12]. Un seul binaire Go, rien à ajouter au monorepo.

## 2. Artillery

### 2.1 Licence, maintenance

- Dépôt `artilleryio/artillery`, licence MPL-2.0, 9 100 étoiles, dernier push le 20/10/2026 [A1].
- Versions 2.0.x régulières : 2.0.30 (05/02/2026), 2.0.31 (24/04), 2.0.32 (19/05), 2.0.33 (16/06), 2.0.34 (14/08/2026) [A1]. 2.0.34 apporte l'ESM complet dans les processeurs [A2].
- Exige Node >= 22.18.0 (`engines` du paquet) [A3]. Le poste a Node 22.23.1.
- **Télémétrie anonyme active par défaut**, envoyée à PostHog ; `ARTILLERY_DISABLE_TELEMETRY` la coupe [A4].

### 2.2 Réutiliser `contract`

- Le scénario est un YAML ; la logique va dans un processeur (`config.processor`) en `.js`, `.mjs` ou `.ts`. « Artillery bundles your TypeScript code into a single CommonJS module. » TypeScript n'est pris en charge qu'en local et sur AWS Fargate [A5]. Le support TypeScript est arrivé en expérimental en 2.0.4 (12/01/2024) [A6].
- Un processeur `.ts` peut donc importer `contract` (bundle fait par Artillery). Mais les requêtes HTTP se décrivent dans le YAML (`url`, `method`) : pour s'appuyer sur les descripteurs, il faut calculer l'URL dans un hook `beforeRequest`, qui peut modifier « the URL, cookies, headers, and body » [A7]. Le YAML garde alors des requêtes sans chemin réel, ce qui rend le scénario moins lisible.

### 2.3 Cookies, en-têtes, phases, mesures

- **Cookies** : « Cookies are remembered and re-used by individual virtual users » [A7].
- **En-têtes** : `config.http.defaults.headers` les applique à toutes les requêtes [A7].
- **Phases** : `config.phases` est parcouru dans l'ordre ; quatre types : `arrivalRate`, `rampTo`, `arrivalCount`, `pause` ; `maxVusers` plafonne [A5].
- **Le modèle diffère** : « Each "arrival" is a new virtual user », qui exécute un scénario « to completion » [A8]. Artillery pense en flux de nouveaux utilisateurs, pas en 80 téléphones qui restent connectés toute la journée. Pour 80 téléphones fixes, il faut 80 arrivées dont le scénario boucle (`loop`), et un pic synchronisé se code à la main dans le processeur (attendre une heure donnée). Faisable, moins direct que dans k6.
- **Mesures** : le rapport console affiche pour chaque histogramme `min, max, mean, median, p95, p99` [A9] ; `http.response_time` (mesuré au premier octet), `http.codes.<code>` [A7]. Seuils de réussite par le plugin `ensure` (`p99`, etc.) [A10].

## 3. autocannon

- Dépôt `mcollina/autocannon`, licence MIT [C1]. Après 8.0.0 (14/10/2024), 9.0.0 sort le 06/11/2026 : mise à jour des dépendances, remplacement d'un parsing d'URL obsolète, tests migrés vers `node:test` [C1][C2]. Activité faible mais pas d'abandon.
- **Modèle** : `connections` connexions concurrentes pendant `duration` secondes ou `amount` requêtes ; débit plafonné par `overallRate` [C3]. Aucune notion de phase : une seule charge du début à la fin.
- **Cookies** : aucune boîte à cookies. Un `context` par connexion, lisible dans `setupRequest` et `onResponse`, remis à `initialContext` quand la séquence de requêtes recommence [C3]. Gérer 80 sessions reviendrait à tout écrire à la main.
- **Mesures** : percentiles de latence `p2_5, p50, p75, p90, p97_5, p99, p99_9…` ; **pas de p95** [C3]. Compte `errors`, `timeouts`, `non2xx`.
- Conclusion : outil de benchmark d'un endpoint (débit maximal, régression de perf), pas de simulation d'utilisateurs. Hors course.

## 4. Script Node maison

- **`contract`** : import direct de `@chimeres/contract` depuis un paquet du workspace, avec tous les types (`ParamsOf`, `BodyOf`, `ResponseOf`) ; `tsx` 4.23.15 est déjà dans le lockfile [P7]. C'est le seul candidat où un descripteur renommé casse la compilation du test.
- **Cookies** : `fetch` de Node n'a pas de boîte à cookies. `Headers.getSetCookie()` lit les `Set-Cookie` ; il faut les stocker et les renvoyer par utilisateur virtuel [N1]. Deux cookies à gérer, donc peu de code.
- **En-têtes** : undici, sous le `fetch` de Node, lève les restrictions du standard : « In Undici, these constraints are removed to give more control to the user » [N2]. `Sec-Fetch-Site` et `Origin` passent.
- **Connexions** : pour que 80 téléphones aient 80 connexions TLS, chaque utilisateur virtuel prend son propre `Agent` undici ; sinon le dispatcher global les mutualise [N2].
- **Mesures** : `perf_hooks.createHistogram()` donne `percentile(50 | 95 | 99)` [N3]. Phases, rapport, seuils et code de sortie restent à écrire.
- **Risques** : la boucle d'événements du générateur peut fausser les latences s'il calcule trop ; pas de correction de l'omission coordonnée ; code de mesure à maintenir et à faire relire. À 80 utilisateurs, la charge côté client reste faible.

## 5. Recommandation

**k6**, sur la branche v2 (2.4.0), installé comme binaire ou par apt, hors du monorepo.

- C'est le seul outil qui couvre tous les critères sans code de plomberie : un utilisateur virtuel avec sa boîte à cookies, des scénarios parallèles ou décalés (`startTime`) pour la montée, le plateau, le pic des 80 téléphones et les 2 ou 3 Organisateurs, p95/p99 et taux d'erreur, et des seuils qui donnent un code de sortie.
- Son modèle (des VUs fixes qui bouclent) colle à 80 téléphones présents toute la journée, mieux que le flux d'arrivées d'Artillery.
- Les descripteurs se réutilisent par le JS compilé de `contract` (`dist/index.js`), ou par un bundle esbuild si l'import direct échoue. Le typage se garde par un `tsc --noEmit` du script avec `@types/k6`.
- Deux précautions : `noCookiesReset: true` (ou des sessions ouvertes dans `setup()`), et `summaryTrendStats` avec `p(99)`.
- Le script Node maison est la seule alternative sérieuse si l'import de `contract` dans k6 se révèle pénible : meilleure intégration au code, mais phases, mesures et rapport à écrire et à fiabiliser. Artillery vient ensuite (télémétrie par défaut, YAML éloigné des descripteurs). autocannon est écarté.

Premier pas proposé pour #208 : un script k6 de dix lignes qui importe `packages/contract/dist/index.js` et appelle `conventionEndpoints.read` contre `test2.nekbet.fr`, pour lever le doute du §1.3 avant d'écrire les scénarios.

## Points incertains

- L'import de `contract/dist/index.js` par k6 est déduit de la doc et du code, pas essayé (aucun binaire k6 n'a été lancé).
- Le comportement de la boîte à cookies de k6 avec le préfixe `__Host-` n'est décrit dans aucune doc lue.
- Aucune doc de k6 ne décrit une synchronisation fine des VUs pour le pic : l'écart réel entre la première et la dernière des 80 requêtes est à mesurer.
- La doc d'Artillery ne donne pas le comportement exact d'un VU après son scénario au-delà de « run it to completion ».
- Ce que Node 22 garde ou non en commun entre deux `fetch` sans `Agent` dédié (réutilisation des connexions) n'a pas été vérifié dans le code d'undici.

## Sources

Projet (lu le 15/11/2026) :

- [P1] `packages/contract/src/endpoint.ts`
- [P2] `packages/contract/src/convention.ts`, `linked-phone.ts`, `account.ts`, `participant.ts`
- [P3] `packages/contract/src/*.ts`, `packages/contract/dist/*.js`, `tsconfig.base.json` (`target: ES2023`, `module: nodenext`)
- [P4] `apps/api/src/front-office/http/linked-phone-cookie.ts`
- [P5] `apps/api/src/account/http/account-session-cookie.ts`
- [P6] `apps/api/src/http/cross-site-write.guard.ts` (ADR 0019)
- [P7] `pnpm-lock.yaml` (esbuild 0.28.2, tsx 4.23.15)

k6 :

- [K1] Dépôt et releases : https://github.com/grafana/k6/releases (API GitHub, 15/11/2026)
- [K2] Notes de version v2.0.0 : https://github.com/grafana/k6/releases/tag/v2.0.0 ; Sobek mentionné dans les notes de 2.x et 1.8.x
- [K3] JavaScript and TypeScript compatibility mode : https://grafana.com/docs/k6/latest/using-k6/javascript-typescript-compatibility-mode/
- [K4] Modules : https://grafana.com/docs/k6/latest/using-k6/modules/
- [K5] URLs with query parameters : https://grafana.com/docs/k6/latest/examples/url-query-parameters
- [K6] Cookies : https://grafana.com/docs/k6/latest/using-k6/cookies/
- [K7] Options reference (`summaryTrendStats`, `noCookiesReset`) : https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/
- [K8] Scenarios : https://grafana.com/docs/k6/latest/using-k6/scenarios/
- [K9] Executors : https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/
- [K10] Per VU iterations : https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/per-vu-iterations/
- [K11] Thresholds : https://grafana.com/docs/k6/latest/using-k6/thresholds/
- [K12] Install k6 : https://grafana.com/docs/k6/latest/set-up/install-k6/

Artillery :

- [A1] Dépôt et releases : https://github.com/artilleryio/artillery/releases (API GitHub et npm, 15/11/2026)
- [A2] Notes de version 2.0.34 : https://github.com/artilleryio/artillery/releases/tag/artillery-2.0.34
- [A3] `packages/artillery/package.json`, champ `engines`
- [A4] `packages/artillery/lib/telemetry.ts`
- [A5] Test script reference : https://www.artillery.io/docs/reference/test-script
- [A6] Notes de version 2.0.4 : https://github.com/artilleryio/artillery/releases/tag/artillery-2.0.4
- [A7] HTTP engine : https://www.artillery.io/docs/reference/engines/http
- [A8] Core concepts : https://www.artillery.io/docs/get-started/core-concepts
- [A9] `packages/artillery/lib/console-reporter.ts`
- [A10] `packages/types/schema/plugins/ensure.js`

autocannon :

- [C1] Dépôt, releases et npm : https://github.com/mcollina/autocannon (API GitHub et `npm view autocannon`, 15/11/2026)
- [C2] Historique des commits depuis 8.0.0 : https://github.com/mcollina/autocannon/commits/master
- [C3] README : https://github.com/mcollina/autocannon#readme

Node :

- [N1] `Headers.getSetCookie()` : https://nodejs.org/api/globals.html#class-headers et https://developer.mozilla.org/docs/Web/API/Headers/getSetCookie
- [N2] README d'undici (« Forbidden and Safelisted Header Names », dispatcher global) : https://github.com/nodejs/undici#readme
- [N3] `perf_hooks.createHistogram()` : https://nodejs.org/api/perf_hooks.html#perf_hookscreatehistogramoptions
