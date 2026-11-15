# Plan de test de charge de l'API

Ce plan rassemble les décisions de la carte [Carte : tests de charge de l'API](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/202). Chaque section renvoie au ticket qui contient le détail et les raisons du choix.

## 1. But et règle d'usage

- **Besoin** : PRD § Charge, « jusqu'à ~80 personnes qui consultent et s'inscrivent en même temps, avec un pic à chaque publication ».
- **But** : contrôler la charge avant une convention. Le test se lance à la main. Il n'y a pas de garde-fou en CI pour l'instant.
- **Cible** : `test2.nekbet.fr`, avec son propre PostgreSQL. Cette machine (152.228.233.17) héberge aussi la production et d'autres services. Le test ne touche jamais la base de production. **test2 reste donc en place.**
- **Règle** : on ne lance jamais de test pendant une convention. Les utilisateurs des autres services de la machine sont prévenus avant chaque lancement. Ces services ont peu d'utilisateurs, donc on peut choisir le moment. `run.sh` demande une confirmation tapée avant de toucher au serveur.
- **Simulation** : des utilisateurs virtuels HTTP rejouent les requêtes de la PWA et de l'écran de suivi. Aucun vrai navigateur n'est utilisé.

## 2. Outil et emplacement du code

Détail : [Choix de l'outil de test de charge](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/203), [docs/research/outil-test-de-charge.md](../research/outil-test-de-charge.md).

- **k6** (2.x), installé sur le poste hors du monorepo (apt ou binaire).
- Le code est dans le dossier `load-test/` à la racine. Ce dossier ne fait pas partie du workspace pnpm :
  - `load-test/k6/` : les scripts k6. Ils importent `packages/contract/dist/index.js`, donc il faut lancer `pnpm build` avant. Si cet import ne marche pas, on passe par un bundle esbuild ;
  - `load-test/fake-push/` : le faux service de push (script Node et son Dockerfile) ;
  - `load-test/docker-compose.load-test.yml` : ce fichier est copié seulement sur test2 ;
  - `load-test/run.sh` : le script de lancement ;
  - `load-test/results/` : les résultats bruts, ignorés par git.
- Réglages obligatoires de k6 : `noCookiesReset: true`, et `summaryTrendStats` avec `p(99)`.
- Les URL se construisent par `apiUrl()` et les descripteurs de `contract`. Aucune route n'est écrite en dur. Ne pas appeler `buildFrontOfficeUrl`, car `URLSearchParams` n'existe pas dans k6.
- Chaque écriture pose `Sec-Fetch-Site: same-origin`, à cause du garde CSRF (ADR 0019).
- Les trois points ouverts du choix de l'outil ([#210](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/210)). Les deux premiers sont vérifiés au premier essai (15/11/2026, k6 2.3.0), le troisième est une décision, codée avec le pic :
  - **import de `contract`** : k6 importe directement `packages/contract/dist/index.js`. Le bundle esbuild n'est pas nécessaire ;
  - **cookie `__Host-account-session`** : la boîte à cookies de k6 le garde et le renvoie. Après `logIn`, toutes les écritures de l'Organisateur passent. Le cookie `linked-phone` (`Path=/api`) passe aussi ;
  - **le pic** : il suit l'horloge, pas la réception du push. `setup()` fixe un instant commun. Chaque téléphone du pic dort jusqu'à cet instant, puis relit dans sa fenêtre (0 à 2 s, ou 60 s pour les applications fermées). L'écart réel entre la première et la dernière relecture se mesure dans l'issue du pic.
- Le typage se vérifie à part : `tsc --noEmit`, avec `@types/k6` et les `.d.ts` de `contract/dist` (`pnpm --ignore-workspace typecheck` dans `load-test/`).

## 3. Requêtes rejouées

Détail : [Relever les requêtes du front office et de l'écran de suivi, phase par phase](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/204#issuecomment-6894985082).

- **Ouverture de l'application** : `frontOfficeEndpoints.read` et `linkedPhoneEndpoints.read` en parallèle, puis `pushSubscriptionEndpoints.readPublicKey`. Si le téléphone est relié, il appelle aussi `pushSubscriptionEndpoints.save`, puis fait une lecture.
- **Lecture** (l'unité de charge du téléphone) : `frontOfficeEndpoints.readSchedule` et `frontOfficeEndpoints.readSituation` en parallèle. Un téléphone ne fait jamais deux lectures en même temps.
- **Gestes** : `signUpEndpoints.signUp` et `signUpEndpoints.withdraw`. Chaque geste est suivi d'une lecture.
- **Écran de suivi** : `accountEndpoints.read` au chargement, puis `signUpTrackingEndpoints.read` toutes les 30 s et après chaque geste.

## 4. Scénarios et volumes

Détail : [Scénarios de charge : profils, rythmes et volumes par phase](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/205#issuecomment-6895185201).

Un seul lancement k6 enchaîne les phases d'un créneau. Chaque requête porte le tag `scenario` de sa phase. Un téléphone est un seul utilisateur virtuel k6, du début à la fin : il garde ainsi son cookie d'une phase à l'autre. `PHASE=arrival` ou `PHASE=sign-ups` lance une seule phase pendant la mise au point. Seuls, les téléphones des inscriptions se relient d'abord en 20 s, sans s'abonner au push (tag `quick-link`).

| Phase | Profil |
|---|---|
| Arrivée | 80 téléphones en 2 min, montée linéaire. Chaque téléphone ouvre l'application, puis appelle `verifyPresenceCode`, attend 5 à 15 s de saisie, appelle `link` et `linkedPhoneEndpoints.read`, s'abonne au faux push, appelle `pushSubscriptionEndpoints.save` et fait une première lecture. 10 % saisissent le pseudo d'un MJ et refont `link` avec la confirmation `game-master`. |
| Inscriptions | Plateau de 10 min. Chaque téléphone s'inscrit à sa partie garantie à un instant tiré dans les 30 premières secondes (le départ décalé), puis fait une lecture toutes les 30 s, une lecture de changement d'écran toutes les 30 à 90 s, et un geste toutes les 2 min en moyenne (intervalles exponentiels ; 70 % `signUp` sur une partie où il n'est pas, 30 % `withdraw`). Les gestes portent sur les 6 parties du créneau mesuré. Une lecture prévue pendant la précédente s'y fond. Charge attendue : environ 8 à 10 GET/s et moins d'une écriture par seconde (environ 9,5 GET/s et 0,8 écriture/s à 80 téléphones). Le résumé donne le nombre de GET du plateau (`http_reqs{scenario:sign-ups,method:GET}`) : le débit est ce nombre divisé par 600. |
| Pic de publication | Un Organisateur appelle `drawEndpoints.launch`, puis `publish` 30 s plus tard. À partir d'un instant commun, 80 % des téléphones (page ouverte) relisent dans une fenêtre de 0 à 2 s. Les 20 % restants (application fermée) ouvrent l'application puis lisent, étalés sur 60 s. Les lectures toutes les 30 s continuent. Le déclenchement suit l'horloge, pas la réception du push. |
| Organisateurs en fond | 3 Organisateurs, du début à la fin : `accountEndpoints.read`, puis `signUpTrackingEndpoints.read` toutes les 30 s. Un seul d'entre eux porte les gestes du pic, et chaque geste est suivi d'une relecture du suivi. |

- **Paliers** : le nombre de téléphones est un paramètre. On fait trois lancements séparés : 80, puis 160, puis 240 si 160 tient. On s'arrête au palier où le p95 ou le taux d'erreur décroche. Il y a toujours 3 Organisateurs, et les durées ne changent pas.
- Le test couvre un seul créneau. Les créneaux suivants répètent la même charge.

## 5. Données de départ et remise à zéro

Détail : [Données de départ et remise à zéro de la base de test2](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/207#issuecomment-6895530263).

- **Remise à zéro avant chaque palier**, par SSH depuis `run.sh` : on arrête `app` et `database`, on supprime le volume `db_data`, puis on relance avec `docker-compose.load-test.yml`. Les migrations recréent la convention, et l'API recrée l'Organisateur.
- **Préparation** dans le `setup()` de k6, par `contract`. L'Organisateur se connecte par `accountEndpoints.logIn` avec le `ORGANIZER_PSEUDO` / `ORGANIZER_PASSWORD` de test2. Ces identifiants sont gardés sur le poste (variables d'environnement ou fichier ignoré par git). Le code de présence se lit par `conventionEndpoints.read`.
- **Volumes** : 5 créneaux, 6 tables, 6 parties par créneau (28 parties, dont les 2 doubles, pour 30 cases), 5 places au plus par partie, 15 MJ avec 2 à 3 scénarios chacun, une présentation d'environ 800 caractères sans image, deux parties doubles, 3 scénarios en réserve, soit 31 scénarios. Aucun participant n'est créé d'avance : les pseudos naissent pendant l'arrivée.
- **Dates** : la convention a lieu le jour du lancement. Le créneau mesuré commence une heure après le lancement, et les 4 autres suivent le même jour. Les heures reculent si elles dépassent minuit.
- **Publication garantie** : chaque téléphone s'inscrit d'abord à la partie `n mod 6` du créneau mesuré, ou à la suivante si c'est celle de son MJ. Celle d'un téléphone de MJ est de secours (IN-4) : elle ne compte pas au tirage, mais les autres téléphones remplissent chaque partie. Ses désinscriptions ne touchent jamais cette première inscription.

## 6. Faux service de push

Détail : [Faux service de push : forme et branchement](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/206#issuecomment-6895317892).

- Le conteneur `fake-push` est sur le réseau Docker de test2. Il répond en https avec un certificat auto-signé au nom du conteneur. `docker-compose.load-test.yml` le déclare, monte la CA dans `app` et pose `NODE_EXTRA_CA_CERTS`. Le Caddy edge et le DNS ne changent pas.
- test2 a sa propre paire de clés VAPID, dans son `.env`. Elle n'est jamais celle de la production.
- `POST /subscriptions` renvoie `{endpoint, keys}` (vraie clé P-256, `auth` de 16 octets). `fake-push` garde la clé privée. Il répond 201 après un délai réglable (`DELAY_MS`) et déchiffre chaque message reçu (`aes128gcm`, sans dépendance npm).
- `GET /stats` donne le nombre de messages lisibles, l'heure de réception du premier et du dernier, le nombre par abonnement et le nombre de messages illisibles. `POST /reset` remet tout à zéro, abonnements compris.
- k6 joint le port d'administration par un tunnel SSH. Ce port (`FAKE_PUSH_ADMIN_PORT`, 9230) est publié seulement sur le `127.0.0.1` du serveur. Le port d'envoi (8443) reste sur le réseau Docker `chimeres_test2_push_net`, qui n'est pas `internal` : Docker ne publie aucun port d'un conteneur seulement sur un réseau interne.
- La CA est refaite à chaque démarrage de `fake-push`, dans le volume `fake_push_ca`. `app` attend donc que `fake-push` soit prêt pour démarrer.
- L'image se construit sur le poste. `run.sh` la charge par SSH si elle a changé.
- `fake-push` ne vit que le temps d'un lancement. Il ne partage pas de code avec `apps/api/test/fake-push-service.ts`.

## 7. Mesures

Détail : [Mesures et lancement : ce qu'on relève et d'où on tire](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/208#issuecomment-6895668598).

- **Côté k6**, chaque requête porte les tags `endpoint` (clé du descripteur) et `scenario`. On relève, par endpoint et par phase : p50, p95, p99, max, `http_req_failed` et les codes HTTP. `handleSummary()` écrit le résumé en JSON et en texte.
- **Refus attendus** : un `responseCallback` par requête marque comme attendus les refus métier normaux. Par exemple, `linkedPhoneEndpoints.read` avant `link` (`phone-not-linked`). Une partie n'est jamais complète à l'inscription : on peut s'inscrire au-delà des places (partie très demandée, IN-5). Le seul refus possible d'un `signUp` est `game-led-by-participant`, et les téléphones de MJ l'évitent en lisant `ledGameId`. Le taux d'erreur ne compte donc que les 5xx, les délais dépassés et les 4xx imprévus.
- **Deux métriques propres** :
  - le délai du pic, de la réponse de `publish` à la dernière relecture ;
  - la durée d'envoi des notifications, de la réponse de `publish` à la dernière réception dans `fake-push`. Les échecs se calculent ainsi : notifications attendues moins notifications reçues. On les recoupe avec les avertissements `Envoi push refusé` des journaux de `app`.
- **Côté serveur**, toutes les 5 s par SSH, dans un CSV horodaté :
  - `docker stats --no-stream` sur tous les conteneurs de la machine ;
  - `/proc/loadavg` et `free` ;
  - `pg_stat_activity` de la base de test2, avec le nombre de connexions par état. Si 10 connexions restent actives longtemps, le pool est saturé.
- Le pool `pg` reste à 10 connexions. On ne le règle que si la mesure le montre.
- **Référence** : avant les paliers, on lance une mesure à 1 téléphone sur une base vide. Elle donne la latence propre au réseau du poste.
  - Première mesure, 15/11/2026, arrivée seule, depuis le poste : 0 erreur sur 171 requêtes (préparation comprise). `readSchedule` 82 ms, `readSituation` 57 ms, `link` 45 ms, `frontOfficeEndpoints.read` 33 ms, `linkedPhoneEndpoints.read` 30 ms, `verifyPresenceCode` 22 ms, `readPublicKey` 12 ms (une requête chacun). La confirmation de MJ (`link` avec `game-master`), faite par un téléphone sur dix à partir du dixième, a passé dans un essai à 10 téléphones, sans erreur.
  - Inscriptions seules (`PHASE=sign-ups`), 80 téléphones, 15/11/2026 : 9,1 GET/s sur le plateau (5 474 GET en 600 s). p95 : `readSchedule` 193 ms, `readSituation` 108 ms, `signUp` 128 ms, `withdraw` 90 ms. 2 erreurs sur 6 906 requêtes (0,02 %), d'origine inconnue : le résumé donne depuis un taux d'erreur par endpoint.

## 8. Lancer une campagne

1. **Prérequis sur le poste** : k6 installé, `pnpm build` fait, accès SSH au serveur, identifiants de test2 disponibles.
2. **Prérequis sur le serveur** : les clés VAPID propres à test2 sont dans son `.env` (`npx web-push generate-vapid-keys`). `run.sh` refuse de partir sans elles, ou si ce sont celles de la production. Il copie lui-même `docker-compose.load-test.yml`.
3. **Prévenir** les utilisateurs des autres services de la machine, et vérifier qu'aucune convention n'est en cours.
4. Mettre `GUARD_URLS` dans `load-test/.env` : l'`/api/health` de la production, puis une URL par service de la machine.
5. Lancer `load-test/run.sh <palier> [délai du push en ms]`. Le script :
   1. demande une confirmation tapée, « lancer <palier> » (pas de convention en cours, autres services prévenus). Sans elle, il ne touche pas au serveur ;
   2. contrôle le dossier de test2 (`PUBLIC_DOMAIN`, projet Compose) et ses clés VAPID ;
   3. construit l'image de `fake-push`, la charge sur le serveur si elle a changé, et copie `docker-compose.load-test.yml` dans `/opt/hdc-test2` ;
   4. remet la base de test2 à zéro (`down --volumes`) et relance avec `docker-compose.load-test.yml` ;
   5. ouvre le tunnel SSH vers `fake-push`, appelle son `/reset`, et lance la collecte côté serveur (`collect-server.sh`). Le CSV s'écrit sur le poste au fil de l'eau, une ligne par mesure : `time,source,subject,metric,value` ;
   6. lance k6 ;
   7. à la fin, ou sur Ctrl-C par un `trap` : rapatrie les statistiques de `fake-push` et les journaux de `app`, arrête `fake-push` et relance `app` sans `docker-compose.load-test.yml`. Tout est dans `load-test/results/<date>-<palier>/` : `server.csv`, `k6.txt`, `app.log`, `fake-push-stats.json`.
   Essais du 15/11/2026 à 1 téléphone : un lancement complet (0 erreur sur 317 requêtes, un abonnement compté par `fake-push`, `pushSubscriptionEndpoints.save` en 49 ms), puis un Ctrl-C pendant `setup()`. Dans les deux cas, test2 est revenu dans sa configuration normale et les mesures sont restées. Un Ctrl-C pendant `setup()` ne laisse pas de résumé k6.
6. **Ordre d'une campagne** : la référence à 1 téléphone, puis 80, 160 et 240 téléphones, avec une réponse du push à 0 ms. On refait ensuite le palier 80 avec une réponse du push à 300 ms.

Le test s'arrête vite dans trois cas :

- Ctrl-C sur k6 ;
- `abortOnFail` si le taux d'erreur dépasse 20 %. k6 calcule ce taux depuis le début du test, pas sur une fenêtre glissante : il n'est jugé qu'après 30 s (`delayAbortEval`) ;
- le garde-fou : un scénario k6 interroge toutes les 5 s `/api/health` de la production et une liste d'URL des autres services de la machine (`GUARD_URLS`, sur le poste). Si une réponse prend plus de 2 s ou échoue, le test s'arrête (code 108). Il ne tourne pas pendant `setup()`. Vérifié le 15/11/2026 avec une URL fausse.

## 9. Résultats et seuils

- Les résultats bruts sont dans `load-test/results/`, qui est ignoré par git.
- Une synthèse par campagne va dans `docs/load-test/<date>.md` : date, version, paliers, p95, erreurs, CPU max et conclusion. Elle n'est commitée qu'après accord.
- **Les seuils se fixent à la fin de la première campagne**, au moment d'écrire sa synthèse. On les inscrit dans ce plan et dans les `thresholds` de k6, selon la méthode suivante :
  - **à 80 téléphones** (le besoin), par phase :
    - aucune erreur, refus attendus exclus ;
    - p95 des lectures (`readSchedule` + `readSituation`) : la valeur mesurée × 1,5, arrondie, jamais au-dessus de 1 s ;
    - délai du pic et durée d'envoi des notifications : même règle, avec un plafond de 10 s chacun ;
  - **à 160 téléphones** (le double, une marge et non une exigence) : taux d'erreur sous 1 %, et p95 des lectures sous 2 s ;
  - **à 240 téléphones** : informatif, sans seuil.
- Si la mesure à 80 dépasse déjà un plafond, on ouvre une issue d'optimisation avant la convention. On n'assouplit pas les seuils.

## 10. Hors de ce plan

- Le temps de calcul du tirage (`packages/draw`).
- Le poids et le temps d'affichage du front office sur mobile en 4G.
- Un garde-fou de performance en CI.
- Tout test sur la base de production.
- Les autres gestes du jour J (ajustements, réserve) : pas dans ce premier plan.
