# Fraîcheur des données et hors ligne avec le service worker Angular

Recherche du ticket [#45](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/45), sous-issue de la carte #42 (front office mobile). Ce document expose les faits et les options, sans trancher.

**Question** : comment garder le programme et les affectations lisibles sans réseau (PRD §6), tout en montrant des données fraîches ? Le compteur « _N_ inscrits · _M_ places », le badge « Très demandée » (§5.3) et l'état d'un créneau (inscriptions ouvertes, tirage lancé, publié, §5.4 et §5.5) changent en continu le jour de la convention. Sur place, seul le réseau 4G/5G est disponible, pour environ 80 téléphones.

Déjà décidé ([#15](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/15)) : les images de scénario passent par un `dataGroup` en `performance` (`maxSize: 200`, `maxAge: 30d`). Ce document traite les données JSON de l'API, les mises à jour de l'application, le rafraîchissement et les écritures.

Faits relevés le 24 octobre 2026. Versions de `pnpm-lock.yaml` : `@angular/service-worker`, `@angular/core` et `@angular/common` 22.2.3, `@nestjs/*` 12.2.0, `express` 5.3.0. Compatibilité navigateurs : `@mdn/browser-compat-data` 8.1.7 (22 octobre 2026).

Chaque fait est suivi de sa source, numérotée en fin de document. La mention **[code]** signale un fait lu dans le code installé (`ngsw-worker.js` 22.2.3, `@nestjs/core` 12.2.0, `express` 5.3.0), et non dans une documentation.

## Synthèse

- **`freshness` ne se replie sur le cache qu'en cas d'échec réseau ou de `timeout`.** Une erreur HTTP (502 de Caddy pendant un redéploiement, 500) est renvoyée telle quelle, sans repli. Sans `timeout`, une 4G qui traîne fait attendre sans limite **[code]**.
- **`maxAge` borne aussi le repli hors ligne**, dans les deux stratégies. Une entrée plus vieille que `maxAge` est supprimée au lieu d'être servie **[code]**. L'âge repart de zéro à chaque réponse réseau réussie.
- **L'application ne sait pas si une réponse vient du cache.** Le service worker n'ajoute aucun en-tête. Seul l'en-tête `Date` d'origine, conservé dans le cache, ou un horodatage dans le DTO, permet d'afficher « à jour à 14 h 05 ».
- **Mises à jour de l'application** : le service worker cherche une nouvelle version à son démarrage et à chaque navigation **[code]**. Une PWA reprise depuis l'arrière-plan ne navigue pas : sans `SwUpdate.checkForUpdate()`, une version déployée le jour J n'arrive qu'au prochain lancement à froid.
- **Rafraîchissement** : en arrière-plan, Chrome ralentit les minuteries (une fois par seconde, puis une fois par minute après 5 minutes) et peut geler la page. Aucune documentation WebKit trouvée ne décrit ce que fait iOS. `visibilitychange` est le dernier événement fiable, et le bon moment pour relancer une lecture au retour.
- **SSE** passe par le service worker Angular (pas de cache, simple relais), sauf avec `?ngsw-bypass` dans l'URL. **WebSocket** ne passe jamais par un service worker. NestJS 12.2 a `@Sse()` sans dépendance de plus. Caddy transmet `text/event-stream` sans tampon.
- **Coût serveur** : 80 téléphones qui interrogent toutes les 30 s font environ 2,7 requêtes/s, et 80 flux SSE font 80 connexions ouvertes. Les deux restent petits pour un seul processus Node (ordre de grandeur, pas une mesure).
- **Écritures hors ligne** : Background Sync n'existe ni dans Safari (iOS compris) ni dans Firefox. Le service worker Angular laisse passer les `POST` sans file d'attente **[code]**. Une file demanderait un script de service worker à nous, et l'inscription rejouée peut tomber après le lancement du tirage.
- **`httpResource`** : `reload()` garde la valeur précédente pendant le chargement, mais une erreur fait lever `value()`. Avec un service worker qui sert le cache hors ligne, l'erreur ne survient que si le cache est vide ou trop vieux.

## 1. Les données de l'API dans le service worker Angular

### 1.1 État actuel

`apps/front-office/ngsw-config.json` n'a que deux `assetGroups` (`app` en `prefetch`, `assets` en `lazy`) et aucun `dataGroup`. Aucune réponse de `/api` n'est donc mise en cache aujourd'hui. `navigationUrls` exclut `/api/**`, ce qui ne concerne que les navigations. Le service worker est enregistré par `provideServiceWorker('ngsw-worker.js', { registrationStrategy: 'registerWhenStable:30000' })` (`app.config.ts`).

Pour toute requête du périmètre, le worker appelle `event.respondWith()`, sauf avec l'en-tête ou le paramètre `ngsw-bypass` **[code]** (`Driver.onFetch`). Une requête qu'aucun groupe ne couvre est relayée au réseau par `fetch()`, sans cache **[code]** (`Driver.handleFetch`).

### 1.2 Ordre et motifs

- Le worker essaie les `assetGroups`, puis les `dataGroups`, dans l'ordre du fichier. Le premier qui répond gagne **[code]** (`AppVersion.handleFetch`) [1].
- Dans `urls`, « Negative glob patterns are not supported », et « `?` is matched literally » [1].
- Seules les requêtes `GET` et `HEAD` sont mises en cache [1]. Une autre méthode sur une URL couverte retire cette URL du cache, puis part au réseau **[code]** (`DataGroup.handleFetch`). Un `POST` d'inscription n'invalide donc pas le programme si son URL diffère.
- `cacheQueryOptions.ignoreSearch` ignore les paramètres de requête (faux par défaut) [1]. Sinon, chaque combinaison de paramètres est une entrée à part, comptée dans `maxSize`.

### 1.3 Stratégie `performance`

Documentation : « If a resource exists in the cache, the cached version is used, and no network request is made » [1]. Dans le code **[code]** (`handleFetchWithPerformance`) :

- une entrée en cache dont l'âge ne dépasse pas `maxAge` est servie tout de suite ;
- avec `refreshAhead`, si l'entrée a atteint cet âge, une requête réseau part en tâche de fond et met le cache à jour. La réponse affichée reste l'ancienne ;
- sans entrée valide, le réseau répond. Avec `timeout`, un dépassement renvoie un `504 Gateway Timeout` synthétique, et la vraie réponse est mise en cache quand elle arrive.

Pour un compteur qui change toutes les minutes, `performance` affiche donc la donnée en cache jusqu'à `maxAge`, ou jusqu'au rafraîchissement d'avance suivant.

### 1.4 Stratégie `freshness`

Documentation : « preferentially fetching requested data from the network. Only if the network times out, according to timeout, does the request fall back to the cache » [1]. Dans le code **[code]** (`handleFetchWithFreshness`, `networkFetchWithTimeout`) :

- **Hors ligne franc** (le `fetch` échoue tout de suite) : le worker sert le cache, avec ou sans `timeout`.
- **Réseau lent** : avec `timeout`, le cache est servi à l'échéance, et la requête continue en tâche de fond pour remplir le cache. **Sans `timeout`, le worker attend la réponse réseau sans limite.**
- **Erreur HTTP** (500, 502, 503) : la réponse arrive, donc le worker la renvoie telle quelle. Elle n'est pas mise en cache (seules les réponses `ok` le sont), et le cache n'est pas consulté. Un redéploiement, pendant lequel Caddy répond 502, s'affiche donc comme une erreur, et non comme une donnée en cache.
- **Cache vide ou trop vieux, réseau en échec** : la requête échoue (erreur réseau côté page).

`cacheOpaqueResponses` vaut `true` par défaut en `freshness`, `false` en `performance` [1]. Nos appels sont de même origine : ce réglage ne nous concerne pas.

### 1.5 `maxAge`, `maxSize`, `version`

- `maxAge` : « how long responses are allowed to remain in the cache before being considered invalid and evicted » [1]. Le code le vérifie à chaque lecture du cache, **dans les deux stratégies** : au-delà, l'entrée est supprimée et non servie **[code]** (`loadFromCache`). En `freshness`, un `maxAge` court rend donc le repli hors ligne inopérant. L'âge est celui de la dernière réponse réseau réussie : il repart de zéro à chaque mise en cache **[code]** (`cacheResponse`).
- `maxSize` : nombre maximal d'entrées. Au-delà, la moins récemment utilisée sort **[code]**.
- `version` : entier, 1 par défaut. Le cache d'un `dataGroup` n'est pas versionné avec l'application [1] : il survit aux déploiements. Si la forme d'un DTO change de manière incompatible, il faut augmenter `version`, sinon la nouvelle application peut lire un ancien JSON hors ligne.
- `applicationMaxAge` (au niveau du fichier) : au-delà, « all requests will only be served from the network, including asset and data requests » [1]. Il n'est pas défini aujourd'hui.

**Conséquence pour un participant** : s'il charge le programme la veille, puis arrive sur place sans réseau, il ne le voit que si `maxAge` couvre ce délai.

### 1.6 Ce que voit l'application

- Le worker ne signale pas qu'une réponse vient du cache : il renvoie la réponse stockée, en-têtes compris **[code]**. L'en-tête `Date` reste celui de la réponse d'origine. `httpResource` expose `headers()` et `statusCode()` [2] **[code]** (`http.d.ts`). Un horodatage dans le DTO (heure de génération côté serveur) est l'autre moyen d'afficher l'âge d'une donnée.
- `navigator.onLine` est « inherently unreliable » : il ne faut pas désactiver de fonction sur cette base, seulement afficher un indice [3].
- Express 5.3 calcule un `ETag` faible pour les réponses JSON de NestJS (réglage `etag` à `'weak'` par défaut) et répond 304 quand `If-None-Match` correspond **[code]** (`lib/application.js`, `lib/response.js`). Le cache HTTP du navigateur s'en sert sans que l'application ait rien à faire. Aucun test n'a été fait sur ce point avec le service worker.

## 2. Mises à jour de l'application

- Une version est l'ensemble des fichiers d'un build. « A running application continues to run the same version of the application. » Un onglet ne change de version qu'au rechargement, si la version est invalide (hash faux), ou par `SwUpdate` [4].
- Le worker cherche une mise à jour à son initialisation et à chaque requête de navigation **[code]** (`Driver.initialize`, `Driver.handleFetch`). La documentation dit : « Every time the user opens or refreshes the application » [4]. Une PWA qui revient de l'arrière-plan ne fait pas de navigation : elle ne voit pas la nouvelle version tant qu'elle n'appelle pas `SwUpdate.checkForUpdate()`.
- `SwUpdate.versionUpdates` émet `VersionDetectedEvent`, `VersionReadyEvent`, `VersionInstallationFailedEvent` et `NoNewVersionDetectedEvent`. `checkForUpdate()` renvoie une promesse qui peut échouer. `activateUpdate()` change la version sans recharger, ce qui « could break the application » (morceaux chargés à la demande renommés). La voie standard est de recharger après `VersionReadyEvent` [5].
- `SwUpdate.unrecoverable` signale un état irrécupérable (version en cache incomplète) : seul un rechargement le répare [5].
- Une interrogation lancée dès le démarrage (`setInterval`, `interval()`) empêche l'application de devenir stable, ce qui retarde l'enregistrement du service worker jusqu'à 30 s avec notre `registerWhenStable:30000`. La documentation conseille d'attendre `ApplicationRef.isStable` avant de lancer l'intervalle [5]. Cela vaut aussi pour une interrogation des données.
- Hors ligne, `checkForUpdate` s'arrête sans erreur visible (« Client or server offline ») **[code]**.
- Désactivation d'urgence : supprimer ou renommer `ngsw.json` ; sur un 404, le worker vide ses caches et se désinscrit. `safety-worker.js` existe aussi [4].
- Sécurité : trois avis touchent `@angular/service-worker` en 2026 (GHSA-gv2q-mqqv-365m, GHSA-95qp-cmmw-mgqv, GHSA-qxh6-94w6-9r5p). Tous sont corrigés avant 22.0.1 : la 22.2.3 n'est pas concernée [6].

## 3. Rafraîchir les données

### 3.1 Arrière-plan et mise en veille

- **Chrome (Page Lifecycle)** : une page cachée peut être gelée (« JavaScript timers and fetch callbacks don't run ») puis déchargée. `visibilitychange` vers `hidden` est le dernier état observable de façon fiable, « especially true on mobile ». Au gel, il est conseillé de « stop network polling or close open WebSocket connections », et de les relancer au retour [7].
- **Minuteries dans Chrome** : page cachée, les minuteries sont vérifiées une fois par seconde. Après 5 minutes cachée, en silence, pour une chaîne d'au moins 5 appels, une fois par minute [8]. L'article ne dit pas si cela s'applique à Android.
- **`visibilitychange`** se déclenche aussi sur mobile, « switches from the browser to a different app » [9].
- **iOS** : aucune documentation WebKit ou Apple trouvée ne décrit ce que deviennent minuteries, `EventSource` et `WebSocket` d'une web app de l'écran d'accueil passée en arrière-plan. Les fils du forum Apple Developer parlent d'une suspension peu après le passage en arrière-plan, et de connexions coupées, selon les versions. Ce ne sont pas des sources primaires : à tester sur iPhone.
- Conséquence commune à toutes les options : au retour au premier plan (`visibilitychange` vers `visible`), l'application doit relire ses données, quelle que soit la technique choisie.

### 3.2 Interrogation régulière

- Simple avec `httpResource` : `reload()` relance le chargeur (§5).
- Passe par le service worker et ses `dataGroups`, donc par le même cache que la lecture normale.
- Réglages à choisir : intervalle, arrêt quand la page est cachée, relance au retour.
- Batterie : chaque requête réveille la radio du téléphone. Aucune source primaire trouvée ne chiffre ce coût pour la 4G/5G.

### 3.3 Server-Sent Events

**Le protocole** (spécification HTML) [10] :

- `EventSource` se reconnecte seul. Le délai par défaut est « implementation-defined, probably in the region of a few seconds ». Le champ `retry` le change. Le navigateur peut ajouter un délai exponentiel.
- Une réponse autre que 200, ou d'un autre type que `text/event-stream`, arrête la connexion pour de bon : il n'y a plus de reconnexion. Un 204 sert à demander l'arrêt. **Un 502 pendant un redéploiement coupe donc le flux sans retour** : l'application doit le recréer elle-même.
- Le champ `id` fixe le dernier identifiant, renvoyé à la reconnexion (`Last-Event-ID`).
- Les proxys anciens coupent les connexions inactives : une ligne de commentaire toutes les 15 s environ les garde ouvertes.
- La requête est en `cache: no-store`. La spécification ne dit rien des service workers : la requête passe donc par l'événement `fetch` du worker.
- Sans HTTP/2, la limite est de 6 connexions par navigateur et par domaine. En HTTP/2, le nombre de flux est négocié (100 par défaut) [11]. Caddy accepte par défaut `h1 h2 h3` (option `protocols`) [24].

**Avec le service worker Angular** : un `EventSource` sur `/api/…` n'est couvert par aucun groupe, donc le worker le relaie par `fetch()` sans cache **[code]**. Le paramètre `?ngsw-bypass` dans l'URL le fait ignorer du worker **[code]** [4]. `EventSource` ne peut pas poser d'en-tête : seul le paramètre d'URL est possible. Aucune source primaire trouvée ne dit si relayer un flux long par le worker pose problème (durée de vie du worker, Safari).

**NestJS 12.2** : `@Sse()` sur un handler qui renvoie un `Observable<MessageEvent>` (`data`, `id`, `type`, `retry`, `comment`). Le champ `comment` sert de maintien de connexion. Quand le client ferme, Nest se désabonne de l'`Observable`. `@SseSignal()` fournit un `AbortSignal` [12]. Les en-têtes posés par `SseStream` : `Content-Type: text/event-stream`, `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0, no-transform`, `X-Accel-Buffering: no`. En HTTP/1.1, le socket passe en `keepAlive`, sans délai d'inactivité **[code]** (`router/sse-stream.js`).

**Caddy** :

- `reverse_proxy` envoie tout de suite les réponses `text/event-stream`, quel que soit `flush_interval` [13].
- `encode gzip` : les SSE échappent au seuil de 512 octets, « their headers are sent to the client immediately, and the body is streamed as it is written » [14].
- Au rechargement de la configuration, les flux sont fermés, sauf `stream_close_delay` [13]. Le Caddy « edge » est mutualisé : il recharge aussi quand un autre site change. `EventSource` se reconnecte alors seul (pas de code d'erreur HTTP dans ce cas).

### 3.4 WebSocket

- L'ouverture d'un WebSocket se fait avec « service-workers mode is "none" » [15] : le service worker ne la voit jamais.
- NestJS : passerelles avec `@nestjs/websockets` et `socket.io` ou `ws`. « By default, each gateway listens on the same port as the HTTP server » [16]. Ce sont deux paquets de plus.
- Caddy fait le passage en WebSocket sans réglage. Au rechargement, les connexions sont fermées par défaut [13].
- Pas de reconnexion automatique dans l'API du navigateur : il faut l'écrire (ou utiliser socket.io).
- Le flux est à double sens. Pour ce besoin, le serveur parle et le client écoute.

### 3.5 Push web

- Les notifications push sont déjà prévues (§5.6). Quand une application est ouverte, le worker Angular transmet le message push aux onglets avant d'afficher la notification **[code]** (`handlePush`, message `PUSH`, lu par `SwPush.messages`). Un push de publication peut donc déclencher une relecture.
- Le push ne peut pas servir à rafraîchir le compteur en silence : Chrome et Edge exigent `userVisibleOnly: true` [17]. WebKit : « The Web Push API is not an invitation for silent background runtime », et un push sans notification fait révoquer l'abonnement [18].

### 3.6 Coût serveur pour ~80 téléphones

Calculs simples, pas des mesures :

- Interrogation toutes les 30 s : 80 / 30 ≈ 2,7 requêtes/s ; toutes les 15 s : ≈ 5,3 requêtes/s. Chaque requête lit la base. Les téléphones cachés ou gelés n'interrogent plus (§3.1).
- SSE : 80 connexions ouvertes entre Caddy et Node, et entre les téléphones et Caddy. Chaque changement d'état envoie un message à tous. Le serveur doit savoir à qui envoyer quoi : cela suppose une source d'événements dans l'API (aujourd'hui, les commandes ne publient rien).
- Le pic à la publication du tirage (§6) vient surtout des notifications push et des ouvertures d'application qui suivent, pas de la technique de rafraîchissement.

## 4. Écritures hors ligne (inscription)

- **Ce que fait le worker Angular** : un `POST` part au réseau, sans cache ni file d'attente **[code]**. Hors ligne, il échoue tout de suite (erreur réseau, statut 0 dans `HttpErrorResponse`).
- **Background Sync** (`SyncManager`) : disponible dans Chrome et Chrome Android depuis la version 49 ; **absent de Safari, Safari iOS et Firefox** [19] [20]. Le suivi WebKit est le bug 182565 [20]. Periodic Background Sync n'existe que dans Chrome 80 et plus [20].
- **Sans Background Sync**, Workbox rejoue la file « whenever your service worker starts up », ce qui suppose que l'application soit ouverte [21]. Le worker Angular n'offre pas de file. Ajouter la nôtre passe par un script de service worker personnalisé qui commence par `importScripts('./ngsw-worker.js')` [22].
- **Ce que dit le domaine** : une inscription n'est possible que tant que le tirage du créneau n'est pas lancé (IN-2, TI-1). Une inscription mise en attente puis rejouée après le lancement du tirage serait refusée par le domaine. Le participant aurait cru être inscrit. Le compteur et le badge « Très demandée », lus hors ligne, peuvent aussi être faux au moment du choix (IN-5).
- **Refuser hors ligne** : l'action échoue tout de suite, avec un message. Le participant réessaie quand le réseau revient. Rien à ajouter au service worker.

## 5. `httpResource` et `resource`

- `httpResource` relance une requête quand un signal dont il dépend change. Une requête en cours est annulée avant la suivante. Il passe par `HttpClient`, intercepteurs compris. Il n'est pas fait pour les écritures : « Avoid using httpResource for mutations like POST or PUT » [2].
- Statuts : `idle`, `loading`, `reloading`, `resolved`, `error`, `local`. `reload()` relance le chargeur. Pendant `reloading`, `value()` garde la valeur précédente. En `error`, « Reading `value()` throws ». `hasValue()` protège la lecture [23].
- Conséquence : une relecture qui échoue fait perdre l'affichage de la valeur précédente, sauf si le code garde la dernière valeur lui-même. Avec un `dataGroup`, l'échec n'arrive hors ligne que si le cache est vide ou plus vieux que `maxAge` (§1.4), ou sur une erreur HTTP en ligne.
- Aucune option d'intervalle n'existe dans `httpResource` ni `resource` [2] [23]. L'interrogation s'écrit à côté (minuterie qui appelle `reload()`), en tenant compte de `isStable` (§2) et de `visibilitychange` (§3.1).
- `apiResource()` (`src/app/api-resource.ts`) renvoie directement le `HttpResourceRef` : `reload()`, `headers()` et `statusCode()` y sont donc déjà accessibles.

## 6. Options et compromis

Rien n'est tranché ici.

**Stratégie des données JSON** (programme, fiche, affectations) :

- _`freshness` avec `timeout` court_ (quelques secondes) et `maxAge` long (au moins la journée, ou plusieurs jours si le programme se charge avant) : la donnée réseau quand elle arrive vite, le cache sinon. Coûte un temps d'attente égal au `timeout` en 4G faible. Les erreurs HTTP ne se replient pas sur le cache.
- _`performance` avec `refreshAhead` court_ : affichage immédiat, mais la donnée affichée a toujours un temps de retard (la relecture de fond ne sert qu'à l'affichage suivant). Peu adapté au compteur.
- _Deux groupes_ : un pour ce qui change peu (programme, fiche), un pour ce qui change sans cesse (compteurs, état des créneaux). Suppose des endpoints séparés.
- _Données hors service worker_ (`ngsw-bypass`) et cache tenu par l'application (IndexedDB, `localStorage`) : contrôle complet, plus de code.

**Mise à jour de l'application** :

- _Laisser faire_ : la version arrive au prochain lancement à froid.
- _`checkForUpdate()` au retour au premier plan_, puis rechargement après `VersionReadyEvent` : immédiat, mais un rechargement en pleine action. Faut-il demander au participant ?

**Rafraîchissement** :

- _Relecture au retour au premier plan seulement_ : le minimum, nécessaire avec toutes les options.
- _Interrogation_ (par exemple 15 à 60 s, page visible seulement) : passe par le service worker, rien côté serveur.
- _SSE comme signal_ (« le créneau 2 a changé ») suivi d'une relecture REST : temps réel, sans cache pour le flux. Il faut une source d'événements dans l'API, `?ngsw-bypass`, et une reprise après une erreur HTTP (qui arrête `EventSource`).
- _WebSocket_ : temps réel, hors service worker, mais deux paquets de plus et une reconnexion à écrire, pour un besoin à sens unique.
- _Push_ : déjà prévu pour la publication. Ne remplace pas le reste (pas de push silencieux).

**Écritures** :

- _Refus hors ligne_ avec un message clair : simple, honnête vis-à-vis du tirage.
- _File d'attente_ : script de worker à nous, rejoué seulement à l'ouverture de l'application sur iPhone (pas de Background Sync), et refus possible au rejeu après le lancement du tirage.

## Questions ouvertes

1. Quelle fraîcheur faut-il pour le compteur et le badge : la minute, quelques secondes ? Le badge sert à orienter les choix (IN-5) pendant que les inscriptions sont ouvertes.
2. Combien de temps le programme doit-il rester lisible hors ligne : la journée, ou depuis un chargement la veille ou plusieurs jours avant (question liée au point ouvert « Programme public avant la convention », PRD §8) ?
3. L'application doit-elle afficher l'âge des données (« à jour à 14 h 05 ») ou un indicateur hors ligne ?
4. Une inscription tentée hors ligne : refus avec message, ou file d'attente ?
5. Une nouvelle version déployée le jour J : rechargement imposé, proposé, ou au prochain lancement ?
6. Que deviennent minuteries, `EventSource` et connexions d'une web app de l'écran d'accueil iOS en arrière-plan ? À tester sur iPhone (iOS 16.4 et plus), faute de source primaire.
7. Faut-il découper l'API pour séparer les données qui changent peu de celles qui changent sans cesse ?

## Sources

1. Angular, _Service worker configuration_ (`dataGroups`, `navigationRequestStrategy`, `applicationMaxAge`) : https://angular.dev/ecosystem/service-workers/config
2. Angular, _Reactive data fetching with httpResource_ : https://angular.dev/guide/http/http-resource
3. MDN, _Navigator: onLine property_ : https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
4. Angular, _Service worker devops_ (versions, mises à jour, `ngsw-bypass`, désactivation) : https://angular.dev/ecosystem/service-workers/devops
5. Angular, _Communicating with the service worker_ (`SwUpdate`) : https://angular.dev/ecosystem/service-workers/communications
6. Avis de sécurité d'Angular : https://github.com/angular/angular/security/advisories (`gh api repos/angular/angular/security-advisories`)
7. Chrome for Developers, _Page Lifecycle API_ : https://developer.chrome.com/docs/web-platform/page-lifecycle-api
8. Chrome for Developers, _Heavy throttling of chained JS timers beginning in Chrome 88_ : https://developer.chrome.com/blog/timer-throttling-in-chrome-88
9. MDN, _Document: visibilitychange event_ : https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
10. WHATWG, _HTML Standard, Server-sent events_ : https://html.spec.whatwg.org/multipage/server-sent-events.html
11. MDN, _Using server-sent events_ : https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
12. NestJS, _Server-Sent Events_ : https://docs.nestjs.com/techniques/server-sent-events
13. Caddy, _reverse_proxy_ (`flush_interval`, `stream_close_delay`, WebSocket) : https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
14. Caddy, _encode_ : https://caddyserver.com/docs/caddyfile/directives/encode
15. WHATWG, _WebSockets Standard_ (ouverture de la connexion) : https://websockets.spec.whatwg.org/
16. NestJS, _Gateways_ : https://docs.nestjs.com/websockets/gateways
17. MDN, _PushManager: subscribe() method_ : https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
18. WebKit, _Meet Web Push_ : https://webkit.org/blog/12945/meet-web-push/
19. MDN, _Background Synchronization API_ : https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
20. `@mdn/browser-compat-data` 8.1.7 (`api.SyncManager`, `api.PeriodicSyncManager`) : https://github.com/mdn/browser-compat-data ; suivi WebKit : https://webkit.org/b/182565
21. Chrome for Developers, _workbox-background-sync_ : https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
22. Angular, _Custom service worker scripts_ : https://angular.dev/ecosystem/service-workers/custom-service-worker-scripts
23. Angular, _Async reactivity with resources_ : https://angular.dev/guide/signals/resource
24. Caddy, _Global options_ (`protocols`) : https://caddyserver.com/docs/caddyfile/options

Code lu, dans `node_modules/.pnpm` :

- `@angular/service-worker@22.2.3/ngsw-worker.js` : `Driver.onFetch`, `Driver.handleFetch`, `Driver.initialize`, `Driver.checkForUpdate`, `Driver.handlePush`, `AppVersion.handleFetch`, `DataGroup.handleFetch`, `handleFetchWithPerformance`, `handleFetchWithFreshness`, `networkFetchWithTimeout`, `loadFromCache`, `cacheResponse`.
- `@angular/common@22.2.3/types/http.d.ts` : `HttpResourceRef`.
- `@nestjs/core@12.2.0/router/sse-stream.js` : `SseStream`.
- `express@5.3.0/lib/application.js` et `lib/response.js` : `etag`.
