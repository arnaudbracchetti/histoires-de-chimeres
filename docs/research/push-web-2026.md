# Push web en 2026 : iOS, Android, VAPID et envoi côté serveur

Recherche du ticket [#44](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/44), sous-issue de la carte #42 (front office mobile). Elle prépare les tickets #49 (événements notifiés et leurs textes) et #50 (parcours d'accueil). Ce document expose des faits et leurs sources. Il ne tranche rien.

**Question** : que permet vraiment le push web aujourd'hui pour notre usage (PRD §5.6 et §6) ? Une convention d'un jour, 25 à 80 participants, réseau 4G/5G seulement. Les notifications prévues : publication d'un tirage (pic d'environ 80 envois en même temps), nouvelle partie disponible, notifications propres aux MJ.

Faits relevés le 24 octobre 2026. Versions dans `pnpm-lock.yaml` : `@angular/service-worker` 22.2.3, `@nestjs/*` 12.2.0 (le ticket parle de NestJS 11+, le projet est en 12). État du front office : `provideServiceWorker('ngsw-worker.js', { registrationStrategy: 'registerWhenStable:30000' })` dans `app.config.ts`, et un `manifest.webmanifest` en `display: "standalone"`, sans champ `id`.

Chaque fait renvoie à une source numérotée, listée en fin de document. « BCD » désigne les données de compatibilité de MDN (`mdn/browser-compat-data`), lues le 24 octobre 2026.

## Synthèse

- **iPhone** : le push web exige une app ajoutée à l'écran d'accueil (iOS 16.4 et plus). Hors de l'écran d'accueil, `Notification` n'existe pas dans la page. Depuis iOS 26, tout site ajouté à l'écran d'accueil s'ouvre par défaut comme une app web.
- **Chaque push doit afficher une notification sur iOS.** Le code de WebKit supprime tous les abonnements d'une origine après 3 push silencieux. Chrome tolère un push sans notification seulement si un onglet du site est visible.
- **Permission** : sur iOS et Firefox Android, la demande doit suivre un geste de l'utilisateur. Un refus ne se rattrape que dans les réglages (Réglages iOS, ou paramètres du site dans Chrome). Chrome Android bloque 7 jours après 3 fermetures du prompt. Depuis Chrome 155 (stable le 6 octobre 2026), le prompt Android est non bloquant et peut expirer : la réponse est alors `default`.
- **Declarative Web Push** : seul Safari le prend en charge (iOS 18.4 et plus). Le navigateur affiche la notification sans service worker, et la notification s'ouvre sur l'URL `navigate`. Chrome et Firefox ne l'implémentent pas. Un contenu déclaratif reste lisible par un service worker classique.
- **`SwPush` d'Angular 22** : stable, mais le service worker d'Angular est en maintenance (correctifs de sécurité seulement, depuis septembre 2026). Il affiche la notification de tout message qui a `notification.title`, même au premier plan. Sans `data.onActionClick`, un clic n'ouvre rien. Il ne renouvelle pas un abonnement de lui-même.
- **Envoi** : `web-push` (3.6.7, janvier 2024) reste la bibliothèque de référence (6,5 millions de téléchargements par semaine). Le dépôt est actif, mais aucune version n'a été publiée depuis : la branche principale est passée en ESM seul. Par défaut, elle envoie avec un TTL de 4 semaines et une urgence `normal`.
- **Limites** : 4096 octets par message chiffré, soit au plus 3993 octets de contenu. `TTL` obligatoire, `Urgency` et `Topic` optionnels (Apple les prend en charge). Un 404 ou un 410 signale un abonnement mort, à supprimer.
- **Remplacer une notification** : `tag` fonctionne sur Chrome et Firefox Android, pas sur Safari iOS (BCD : « can be set, but has no effect »). `renotify` n'existe que sur Chrome. Aucune source ne donne de délai de livraison chiffré.

## 1. iPhone et iPad

### 1.1 Conditions

- Le push web arrive avec iOS et iPadOS 16.4, pour les apps web de l'écran d'accueil : « A web app that has been added to the Home Screen can request permission to receive push notifications » [1]. Il repose sur Push API, Notifications API et Service Workers [1].
- Le manifeste doit avoir un `display` à `standalone` ou `fullscreen` [1]. BCD précise : « The parent `Notification` interface is undefined unless the page is a web app saved to the home screen. The app's manifest must have a non-default `display` value » [11].
- Depuis iOS 26 et iPadOS 26, « By default, every website added to the Home Screen opens as a web app ». L'utilisateur peut désactiver « Open as Web App » au moment de l'ajout [5]. « Giving users a web app experience simply no longer _requires_ a manifest file » [5].
- Depuis iOS 16.4, les navigateurs tiers (Chrome, Edge, Firefox sur iOS) peuvent aussi ajouter un site à l'écran d'accueil, avec le même comportement [1].
- Aucun compte Apple Developer n'est nécessaire [1][4].
- Les notifications apparaissent sur l'écran verrouillé, dans le centre de notifications et sur une Apple Watch jumelée. Elles suivent les modes Concentration [1].
- L'API Badging (`navigator.setAppBadge`, `clearAppBadge`) fonctionne aussi. La pastille ne s'affiche qu'après l'accord des notifications [1][4].
- Le Manifest ID identifie l'app web. iOS l'associe au nom donné par l'utilisateur, ce qui permet plusieurs copies de la même app [1]. Notre manifeste n'a pas de champ `id`.

### 1.2 Une notification à chaque push

- Apple : « Safari doesn't support invisible push notifications. Present push notifications to the user immediately after your service worker receives them. If you don't, Safari revokes the push notification permission for your site » [4].
- WebKit : « Violations of the `userVisibleOnly` promise will result in a push subscription being revoked » [2].
- Le seuil est dans le code de WebKit : `maxSilentPushCount = 3`, avec le commentaire « If an origin processes more than this many silent pushes, then it will be unsubscribed from push » [7]. Au-delà, `webpushd` supprime tous les abonnements de l'origine [7].
- Conséquence directe : un push ne peut pas servir à rafraîchir des données en silence sur iPhone.

### 1.3 Declarative Web Push

- Annoncé le 27 mars 2025, disponible à partir d'iOS 18.4 et iPadOS 18.4 [3]. Il permet de « request a Web Push subscription and display user visible notifications » sans service worker installé [3]. `window.pushManager` permet de s'abonner sans service worker [3]. BCD : `Window.pushManager` dans Safari iOS 18.4, et dans aucun autre navigateur [11].
- Le format est maintenant dans la spécification Push API du W3C [9] :

```json
{
  "web_push": 8030,
  "notification": {
    "title": "Tirage du créneau 2 publié",
    "body": "…",
    "navigate": "https://exemple.fr/…",
    "tag": "…"
  },
  "mutable": false
}
```

- `web_push` (8030) et `notification` sont obligatoires. Dans `notification`, `title` et `navigate` sont obligatoires. Les autres membres reprennent `NotificationOptions` : `dir`, `lang`, `body`, `tag`, `image`, `icon`, `badge`, `vibrate`, `timestamp`, `renotify`, `silent`, `requireInteraction`, `data`, `actions`. `app_badge` met à jour la pastille [3][9].
- `mutable` est au premier niveau, pas dans `notification`. Safari 26.2 a corrigé une lecture au mauvais niveau : « Fixed reading the mutable field from the outer object instead of as a child of notification » [6].
- Déroulé selon la spécification [9] : le navigateur reconnaît un message déclaratif. Si `mutable` vaut `true` et qu'un service worker existe, il déclenche un événement `push` avec `event.notification` et `event.data` à `null`. Si le service worker n'affiche rien, la notification déclarative s'affiche quand même. Si `mutable` est absent ou faux, aucun événement `push` n'est déclenché.
- Compatibilité : « If it arrives to an older browser, it's handled imperatively by JavaScript as it always had been » [3]. Le JSON arrive alors tel quel au service worker.
- Autres navigateurs : BCD indique `PushEvent.notification` et `Window.pushManager` dans Safari seulement [11]. Mozilla a une position favorable (`position: positive`, standards-positions #1176) [31]. Aucune annonce de Chrome n'a été trouvée sur chromestatus. `Notification.navigate` existe dans Safari 18.5 et Firefox 158, pas dans Chrome [11].
- Bug ouvert : « Declarative Web Push: pushSubscriptionChange requires Service Worker » (WebKit 294421) [8].

### 1.4 Clic sur une notification : bugs ouverts

BCD marque `notificationclick` comme non pris en charge sur Safari iOS [11], alors que des développeurs l'utilisent. Plusieurs bugs WebKit restent ouverts [8] :

- 268797, « notificationclick events in serviceworkers not firing » : `NEW`, dernière activité le 12 octobre 2026 ;
- 263687, « notificationClick openWindow goes to PWA root instead of url given » : `NEW` ;
- 279456, « Clients.openWindow resolving promise too early » : `NEW`.

Le bug 252544 (client inerte juste après le lancement par un clic) est corrigé [8]. Le champ `navigate` (déclaratif, ou `showNotification` dans Safari 18.5 et plus) laisse le navigateur ouvrir l'URL, sans passer par `notificationclick` [9][12].

### 1.5 Ce que Safari iOS ignore

D'après BCD [11] : `actions`, `badge`, `image`, `renotify`, `requireInteraction` et `vibrate` ne sont pas pris en charge. `icon` et `tag` « can be set, but has no effect ». `Notification.silent` n'est pas pris en charge sur iOS (il l'est sur macOS 16.6). `Notification.data` est pris en charge (16.4), mais l'option `data` de `showNotification` est marquée non prise en charge : les données de BCD se contredisent sur ce point.

`getNotifications()` et `Notification.close()` existent sur Safari iOS 16.4 [11].

### 1.6 Nouveautés récentes

Aucune nouveauté sur le push dans les notes de Safari 26.1, 26.4, 26.5, 27.0 et 27.1, ni dans l'annonce de la WWDC26 [6]. Safari 26.0 a ajouté l'inspection automatique des service workers, utile pour déboguer un événement `push` [5].

## 2. Android

### 2.1 Navigateurs

D'après BCD [11] :

| Fonction | Chrome Android | Samsung Internet | Firefox Android |
|---|---|---|---|
| `PushManager.subscribe` | 42 (`applicationServerKey` requis) | comme Chrome | 48, geste requis depuis 79 |
| `Notification.requestPermission` | 42 | comme Chrome | 22, geste requis depuis 79 |
| `tag` | oui | oui | oui |
| `renotify` | 50 | oui | non |
| `actions` | 48 | oui | 152 |
| `image`, `badge`, `requireInteraction` | oui | oui | non |
| `vibrate` | sans effet depuis Android 8 | sans effet | non |
| `pushsubscriptionchange` | 138 | comme Chrome | partiel (sans `oldSubscription` ni `newSubscription`) |
| Declarative Web Push, `navigate` | non | non | `navigate` seulement (158) |

### 2.2 Permission dans Chrome

- Chrome 155, stable le 6 octobre 2026 [20], passe à un prompt Android « less intrusive », avec « Allow » ou « Manage » [20]. « The notification permission request will time out when the non-blocking prompt expires even if the user did not take any decision » : la promesse se résout alors à `default` [20]. Après une première demande, l'utilisateur peut aussi s'abonner depuis les contrôles du site [20].
- Chrome conseille de surveiller `navigator.permissions.query({ name: 'notifications' })` et son `onchange`, pour s'abonner quand l'accord arrive plus tard. Il déconseille de demander au chargement de la page [20].
- Mise sous embargo : dans le code de Chromium, `kDefaultDismissalsBeforeBlock = 3` (« The number of times that users may explicitly dismiss a permission prompt from an origin before it is automatically blocked ») et `kDefaultEmbargoDays = 7`. Avec l'interface discrète, un seul refus suffit [21].
- Rattrapage d'un refus : Page info > Autorisations > Notifications, puis « Autoriser » [25].
- Révocation automatique (octobre 2025) : Chrome retire la permission des sites peu visités qui envoient beaucoup. Elle ne touche pas les apps web installées [23].
- Limites de débit (janvier 2026) : seuls les sites jugés « disruptive » sont limités, à au moins 1000 envois par minute. Au-delà, le service répond 429 [24].

### 2.3 Push sans notification dans Chrome

- Un push doit afficher une notification avant la fin de la promesse passée à `event.waitUntil()`. Sinon Chrome affiche « This site has been updated in the background » [19].
- Le code de Chromium dispense de notification si un onglet du site est visible : « Sites with a currently visible tab don't need to show notifications ». Sinon, un budget de push silencieux s'applique [22].
- `userVisibleOnly: true` est obligatoire [18].

## 3. Demande de permission

- **Geste de l'utilisateur** : obligatoire pour s'abonner sur Safari (« requesting a push subscription requires an explicit user gesture » [2]). Apple : « call the push subscription method immediately from the gesture's event handler code » [4]. Obligatoire aussi sur Firefox Android depuis la version 79 [11]. Chrome ne l'exige pas, mais déconseille la demande au chargement [20].
- **Résultats** : `granted`, `denied`, ou `default` (« the application will act as if permission was `denied` ») [32].
- **Refus définitif** : « your web app cannot ask the user for permission again ». L'utilisateur doit débloquer lui-même l'app dans un panneau de réglages [18]. Sur iOS, chaque app web a ses réglages dans Réglages > Notifications, comme une app native [1]. Sur Chrome Android, voir §2.2.
- **Service worker actif** : `PushManager.subscribe()` échoue avec `InvalidStateError` si l'enregistrement n'a pas de worker actif [9]. Notre front office enregistre le service worker quand l'app est stable, ou au bout de 30 s (`registerWhenStable:30000`).
- **`pushManager.subscribe()` demande la permission lui-même** : la spécification passe par « request permission to use "push" » [9]. `SwPush.requestSubscription()` appelle directement `pushManager.subscribe()` [27].

## 4. `SwPush` d'Angular 22

### 4.1 État

- L'API `SwPush` est marquée stable [26].
- Le service worker d'Angular est en maintenance. La documentation : « The Angular Service Worker is a basic caching utility for simple offline support with a limited featureset. We will not be accepting any new features other than security fixes. » Le README du paquet, mis à jour le 24 septembre 2026, ajoute « or bug fixes » [26][28].
- Le ticket angular/angular#38690 (renouvellement des abonnements) a été fermé pour cette raison en septembre 2026 [28].

### 4.2 Comportement, lu dans `ngsw-worker.js` 22.2.3 [27]

- **Réception** : un push sans données est ignoré. Sinon, le worker lit `msg.data.json()`, transmet le message aux pages ouvertes (`SwPush.messages`), puis affiche une notification si `notification.title` existe. Il n'y a aucun test de premier plan : la notification s'affiche même si l'app est ouverte.
- **Options copiées** : `actions`, `badge`, `body`, `data`, `dir`, `icon`, `image`, `lang`, `renotify`, `requireInteraction`, `silent`, `tag`, `timestamp`, `title`, `vibrate`. `navigate` n'est pas copié.
- **Clic** : le worker ferme la notification, puis lit `notification.data.onActionClick[action]` (`default` pour un clic sans action). Opérations possibles : `openWindow`, `focusLastFocusedOrOpen`, `navigateLastFocusedOrOpen`, `sendRequest` [26]. Sans `onActionClick`, il ne fait que prévenir les pages ouvertes (`SwPush.notificationClicks`) : si l'app est fermée, rien ne s'ouvre.
- **`pushsubscriptionchange`** : le worker transmet l'ancien et le nouvel abonnement aux pages ouvertes (`SwPush.pushSubscriptionChanges`). Il n'envoie rien au serveur. Si aucune page n'est ouverte, l'information est perdue.
- **Abonnement** : `requestSubscription({ serverPublicKey })` appelle `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` à travers un observable sur l'enregistrement du service worker [27]. Aucune source ne dit si ce passage par un observable conserve le geste de l'utilisateur sur Safari : point à vérifier sur un iPhone.
- **Extension** : un service worker personnalisé peut importer `ngsw-worker.js` en premier (`importScripts('./ngsw-worker.js')`), puis ajouter ses propres écouteurs [26].

### 4.3 Avec Declarative Web Push

D'après la spécification [9] et le code d'Angular [27] :

- Sur Safari 18.4 et plus, un message déclaratif sans `mutable` est affiché par le navigateur. Le worker d'Angular ne le voit pas, donc `SwPush.messages` n'émet rien. Le clic suit `navigate`.
- Avec `mutable: true`, l'événement `push` arrive avec `data` à `null`. Le worker d'Angular sort aussitôt (`if (!msg.data) return;`), et la notification déclarative s'affiche par repli.
- Sur Chrome et Firefox, le même JSON arrive dans `event.data`. Comme il contient `notification.title`, Angular l'affiche, mais sans `navigate`. Pour qu'un clic ouvre une page, il faut aussi `notification.data.onActionClick`.
- Ces déductions viennent de la lecture du code et de la spécification. Elles n'ont pas été testées sur appareil.

## 5. Envoi côté serveur

### 5.1 Bibliothèques Node

| Paquet | Dernière version | Téléchargements / semaine | Remarques |
|---|---|---|---|
| `web-push` | 3.6.7 (16 janvier 2024) | 6 471 000 | MPL-2.0, Node ≥ 16, CommonJS. Dépôt non archivé, dernier commit le 11 septembre 2026. 26 commits non publiés depuis 3.6.7, dont « migrate to ESM-only » (juillet 2026). Types : `@types/web-push` 3.6.4 [29] |
| `@block65/webcrypto-web-push` | 2.0.0 (septembre 2026) | 83 815 | MIT, WebCrypto [29] |
| `@pushforge/builder` | 2.0.5 (avril 2026) | 57 246 | MIT [29] |

Faits sur `web-push` 3.6.7, lus dans son code et son README [29] :

- Options : `TTL` (par défaut 2 419 200 s, soit 4 semaines), `urgency` (par défaut `normal`), `topic`, `timeout`, `contentEncoding` (`aes128gcm` par défaut), `headers`, `agent`, `proxy`.
- Chaque appel signe un nouveau JWT VAPID, valable 12 h par défaut (24 h au maximum). Apple demande : « Don't refresh your JWT more frequently than once per hour » [4]. La fonction `getVapidHeaders()` permet de construire l'en-tête soi-même.
- Une réponse hors 2xx rejette la promesse avec un `WebPushError` qui porte `statusCode`, `headers` et `body`.
- `generateVAPIDKeys()` crée une paire de clés.
- README : un sujet VAPID en `https://localhost`, ou un `mailto:` local, est refusé par Apple (`BadJwtToken`).

### 5.2 Clés VAPID

- La signature utilise ECDSA sur P-256 (`ES256`). Le JWT doit avoir un `exp` au plus 24 h dans le futur. Le `sub` est une URL `mailto:` ou `https:` [16].
- Apple rejette un JWT dont `sub` n'est ni une URL ni un `mailto:`, ou dont `exp` dépasse un jour (`BadJwtToken`) [4].
- La clé publique envoyée doit être celle donnée à `PushManager.subscribe` (`VapidPkHashMismatch` chez Apple) [4].
- Un abonnement est lié à sa clé. Rappeler `subscribe()` avec une autre clé rejette avec `InvalidStateError` [9]. Changer de clé oblige donc chaque appareil à se désabonner puis à se réabonner.
- web.dev : « Create these keys only once for your application, and ensure you keep the private key private » [18].

### 5.3 Taille, TTL, urgence, topic

- **Taille** : un service n'est pas tenu d'accepter plus de 4096 octets. Avec le chiffrement, cela laisse au plus 3993 octets de contenu [15]. Un service ne peut pas répondre 413 à un corps de 4096 octets ou moins [14]. Apple : `PayloadTooLarge` au-delà de 4 Ko [4].
- **TTL** : en-tête obligatoire, en secondes. Le service peut garder le message moins longtemps, et ne le livre plus une fois le délai passé [14]. Avec un TTL de 0, le service tente une livraison immédiate et abandonne si l'appareil est injoignable [17]. Apple garde un message au plus 30 jours, et le nombre de messages gardés pour un appareil hors ligne est limité [4].
- **Urgency** : `very-low`, `low`, `normal`, `high`. Le RFC donne des exemples : `normal` pour un message de chat ou d'agenda, `high` pour un appel ou une alerte urgente, y compris batterie faible [14]. Apple : « To attempt to deliver the notification immediately, specify `high` » [4].
- **Topic** : un message avec un topic remplace un message en attente qui a le même topic. Seuls les messages encore stockés sont remplacés [14]. 32 caractères au plus, alphabet base64url [4][29].
- **Délai de livraison** : aucune source primaire ne donne de délai chiffré. Côté Android, FCM « attempts to deliver high priority messages immediately even if the device is in Doze mode » [30]. Aucune source ne confirme que Chrome traduit `Urgency: high` en priorité haute FCM.

### 5.4 Codes de réponse et abonnements morts

- 201 : accepté [17].
- 404 : « the subscription is expired and can't be used ». Il faut supprimer l'abonnement et attendre que le client se réabonne [17]. Le RFC impose un 404 pour un abonnement expiré [14].
- 410 : « The subscription is no longer valid and should be removed from application server » [17]. Apple : « The device token has expired » [4].
- 413 : contenu trop gros. 429 : trop de requêtes. Chez Apple, 429 signale trop de requêtes consécutives vers le même appareil [4][17].
- Apple accepte HTTP/1.1 et HTTP/2. Il demande au plus 100 requêtes sans réponse sur une connexion HTTP/1.1 [4].
- Pour 80 envois, on reste loin des limites documentées : 1000 par minute chez Chrome, et seulement pour un site jugé disruptive [24].

### 5.5 Expiration et renouvellement

- « A push service MAY expire a subscription at any time » [14]. web.dev : « In practice, however, browsers commonly let subscriptions expire » [18].
- `pushsubscriptionchange` signale « a change in push subscription that was triggered outside the application's control » : renouvellement, révocation ou perte [13]. Prise en charge : Chrome 138, Firefox (partielle), Safari macOS 16. Pas Safari iOS [11].
- MDN prévient qu'un `fetch()` depuis cet événement « will not work if the app is offline » [13].
- Le worker d'Angular ne transmet ce changement qu'aux pages ouvertes (§4.2).
- Ouvert chez WebKit : « iOS service worker - webPush subscription becomes invalid for few users » (273063) [8].

## 6. Remplacer ou regrouper des notifications

- Spécification : une nouvelle notification remplace celle qui a le même `tag` et la même origine, si la plateforme sait remplacer. `renotify` décide si l'utilisateur est prévenu à nouveau [10]. `renotify: true` sans `tag` lève un `TypeError` [12].
- Support (BCD [11]) : `tag` sur Chrome, Samsung Internet et Firefox Android. Sans effet sur Safari. `renotify` sur Chrome et Samsung seulement.
- Repli possible partout : `registration.getNotifications({ tag })` puis `close()` [11][12].
- Le `Topic` (§5.3) agit en amont : il remplace un message pas encore livré, pas une notification déjà affichée [14].

## 7. App au premier plan

- Angular affiche la notification et émet aussi sur `SwPush.messages` (§4.2).
- Chrome n'exige pas de notification si un onglet du site est visible [22].
- Safari iOS exige une notification à chaque push (§1.2). Aucune source ne dit si iOS affiche la bannière quand l'app web est au premier plan. À tester.

## 8. Questions ouvertes

Pour #49 (événements et textes) :

1. Quel TTL pour chaque type de notification ? `web-push` met 4 semaines par défaut. Un « tirage publié » n'a plus de sens après le début du créneau.
2. Un `Topic` par créneau, pour qu'un appareil hors ligne ne reçoive que le dernier message ?
3. `Urgency: high` pour tous les envois du jour J ?
4. Format du contenu : déclaratif (`web_push: 8030` + `navigate`), format Angular (`notification` + `data.onActionClick`), ou les deux dans le même JSON (§4.3) ?
5. Sur iPhone, `tag` est sans effet : accepte-t-on plusieurs notifications successives pour un même créneau, ou ferme-t-on les anciennes par `getNotifications()` ?
6. Aucun push silencieux possible sur iPhone : chaque événement notifié doit avoir un texte visible. Une mise à jour de données sans texte doit passer par autre chose que le push.
7. App ouverte : garde-t-on la notification système (comportement d'Angular), ou un message dans l'app en plus ?
8. Où mène le clic, sachant les bugs WebKit ouverts sur `notificationclick` et `openWindow` (§1.4) ?

Pour #50 (parcours d'accueil) :

1. Sur iPhone, l'ajout à l'écran d'accueil doit précéder la demande de notifications, car `Notification` n'existe pas avant. Comment détecter qu'on est dans l'app installée ?
2. La demande doit suivre un tap, une fois le service worker actif. Faut-il changer `registerWhenStable:30000` pour que le bouton marche dès l'accueil ?
3. `SwPush.requestSubscription()` conserve-t-il le geste de l'utilisateur sur Safari iOS ? À tester sur un appareil.
4. Quel texte et quelles étapes pour rattraper un refus : Réglages > Notifications sur iPhone, Page info > Autorisations sur Android ?
5. Comment traiter `default` après l'expiration du prompt de Chrome 155, et l'embargo de 7 jours après 3 refus ?
6. Faut-il renvoyer l'abonnement au serveur à chaque ouverture de l'app, puisque `pushsubscriptionchange` manque sur iOS et qu'Angular ne relaie rien au serveur ?
7. Faut-il ajouter un `id` au manifeste ?

Questions techniques, hors #49 et #50 :

- Garder `SwPush` et le worker d'Angular (en maintenance), ou écrire un service worker propre ?
- `web-push` 3.6.7 (sans version depuis janvier 2024, ESM seul non publié) ou une autre bibliothèque ?
- Mettre en cache l'en-tête VAPID une heure, comme le demande Apple ?

## Sources

1. WebKit, « Web Push for Web Apps on iOS and iPadOS », Brady Eidson et Jen Simmons, 16 février 2023. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
2. WebKit, « Meet Web Push », 7 juin 2022. https://webkit.org/blog/12945/meet-web-push/
3. WebKit, « Meet Declarative Web Push », Brady Eidson, 27 mars 2025. https://webkit.org/blog/16535/meet-declarative-web-push/
4. Apple Developer, « Sending web push notifications in web apps and browsers ». https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
5. WebKit, « WebKit Features in Safari 26.0 », 15 septembre 2025. https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
6. WebKit, notes de Safari 26.1, 26.2, 26.4, 26.5, 27.0, 27.1 et annonce WWDC26. https://webkit.org/blog/17541/webkit-features-for-safari-26-1/ · https://webkit.org/blog/17640/webkit-features-for-safari-26-2/ · https://webkit.org/blog/17862/webkit-features-for-safari-26-4/ · https://webkit.org/blog/17938/webkit-features-for-safari-26-5/ · https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ · https://webkit.org/blog/18486/webkit-features-for-safari-27-1/ · https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/
7. Code de WebKit : `Source/WebKit/Shared/WebPushDaemonConstants.h` et `Source/WebKit/webpushd/PushService.mm` (branche `main`). https://github.com/WebKit/WebKit
8. Bugs WebKit 268797, 263687, 279456, 252544, 294421, 273063 (statuts lus le 24 octobre 2026). https://bugs.webkit.org/show_bug.cgi?id=268797
9. W3C, Push API, Editor's Draft (section « Declarative push message », `subscribe()`, réception d'un message). https://w3c.github.io/push-api/
10. WHATWG, Notifications API Standard, mise à jour du 19 octobre 2026. https://notifications.spec.whatwg.org/
11. MDN browser-compat-data, fichiers `api/PushManager.json`, `api/PushEvent.json`, `api/Notification.json`, `api/ServiceWorkerRegistration.json`, `api/ServiceWorkerGlobalScope.json`, `api/Window.json` (branche `main`). https://github.com/mdn/browser-compat-data
12. MDN, `ServiceWorkerRegistration.showNotification()`. https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
13. MDN, `pushsubscriptionchange` event. https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event
14. IETF, RFC 8030, « Generic Event Delivery Using HTTP Push » (§5.2 TTL, §5.3 Urgency, §5.4 Topic, §7.2, §7.3). https://www.rfc-editor.org/rfc/rfc8030
15. IETF, RFC 8291, « Message Encryption for Web Push » (§4). https://www.rfc-editor.org/rfc/rfc8291
16. IETF, RFC 8292, « VAPID for Web Push » (§2). https://www.rfc-editor.org/rfc/rfc8292
17. web.dev, « The Web Push Protocol ». https://web.dev/articles/push-notifications-web-push-protocol
18. web.dev, « Subscribing a user ». https://web.dev/articles/push-notifications-subscribing-a-user
19. web.dev, « Handling messages ». https://web.dev/articles/push-notifications-handling-messages
20. Chrome for Developers, « Lighter notification prompts on Android », 22 juillet 2026. https://developer.chrome.com/blog/notification-prompts-android · Calendrier de Chrome 155 : https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=155
21. Code de Chromium : `components/permissions/permission_decision_auto_blocker.cc`. https://chromium.googlesource.com/chromium/src/+/main/components/permissions/permission_decision_auto_blocker.cc
22. Code de Chromium : `chrome/browser/push_messaging/push_messaging_notification_manager.cc`. https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/push_messaging/push_messaging_notification_manager.cc
23. Chromium Blog, « Reducing notification overload for a quieter browsing experience in Chrome », octobre 2025. https://blog.chromium.org/2025/10/automatic-notification-permission.html
24. Chrome for Developers, « Increasing web push notification value with rate limits », 6 janvier 2026. https://developer.chrome.com/blog/web-push-rate-limits
25. Aide Google Chrome, « Use notifications to get alerts » (Android). https://support.google.com/chrome/answer/3220216?hl=en&co=GENIE.Platform%3DAndroid
26. Angular : « Push notifications », API `SwPush`, « Service workers » (vue d'ensemble), « Custom service worker scripts ». https://angular.dev/ecosystem/service-workers/push-notifications · https://angular.dev/api/service-worker/SwPush · https://angular.dev/ecosystem/service-workers · https://angular.dev/ecosystem/service-workers/custom-service-worker-scripts
27. Code de `@angular/service-worker` 22.2.3 installé dans le dépôt : `ngsw-worker.js` (`handlePush`, `handleClick`, `handlePushSubscriptionChange`, `NOTIFICATION_OPTION_NAMES`) et `fesm2022/service-worker.mjs` (`SwPush.requestSubscription`).
28. angular/angular : `packages/service-worker/README.md` (commit du 24 septembre 2026) et ticket #38690. https://github.com/angular/angular/blob/main/packages/service-worker/README.md · https://github.com/angular/angular/issues/38690
29. `web-push` : README, code de la version 3.6.7 (`src/web-push-lib.js`, `src/vapid-helper.js`), registre npm et API de téléchargements npm (semaine du 16 au 22 octobre 2026). https://github.com/web-push-libs/web-push · Mêmes relevés npm pour `@block65/webcrypto-web-push` et `@pushforge/builder`.
30. Firebase, « Set the priority of a message ». https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-priority
31. Mozilla standards-positions, #1176 « [Push API] Declarative Web Push ». https://github.com/mozilla/standards-positions/issues/1176
32. MDN, `Notification.requestPermission()`. https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static
