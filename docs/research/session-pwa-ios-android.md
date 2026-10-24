# Session et stockage d'une PWA sur iPhone et Android

Recherche du ticket [#43](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/43), sous-issue de la carte #42. Elle prépare les tickets #47 (session et codes) et #50 (parcours d'accueil), qui restent à trancher : ce document expose les faits, sans décider.

**Question** : où et combien de temps une identité survit-elle sur le téléphone ? Le stockage (cookies, `localStorage`, IndexedDB) est-il partagé entre le navigateur et la PWA ajoutée à l'écran d'accueil ? Quand est-il effacé sans action de l'utilisateur ? Cookie de session `HttpOnly` ou jeton côté client ? Dans quel ordre le parcours d'accueil (PRD §4.2, ID-1 à ID-3, ADR 0001) peut-il demander le pseudo et l'installation sans perdre l'identité ?

Faits relevés le 24 octobre 2026. Chaque fait est suivi de sa source, numérotée et listée en fin de document. Les sources sont des pages de WebKit, Apple, Chrome, web.dev, Chromium, MDN et OWASP, sauf mention **[secondaire]**. Certaines pages primaires sont anciennes (2017, 2020) : leur date est indiquée. Rien n'a été testé sur un appareil : les points marqués **[à tester]** restent à vérifier sur un iPhone et un Android réels.

État du projet : le manifeste du front office déclare `"display": "standalone"`, `"scope": "./"`, `"start_url": "./"` (`apps/front-office/public/manifest.webmanifest`). L'API est servie sur la même origine, sous `/api`.

## Synthèse

- **iPhone : deux stockages séparés.** Une web app de l'écran d'accueil a ses propres cookies et son propre stockage, séparés de Safari [1][2]. Ce que Safari a enregistré avant l'installation n'est pas garanti dans la web app.
- **Copie des cookies à l'installation : documentée sur Mac seulement.** Sur Mac, Safari copie les cookies (et seulement eux) quand on ajoute un site au Dock [1][3]. Apple ne dit rien de tel pour iOS. Une source secondaire affirme qu'iOS fait la même copie unique **[secondaire]** [16] : **[à tester]**.
- **Android (Chrome) : un seul stockage.** La PWA installée (WebAPK) utilise le profil de Chrome : cookies et stockage sont partagés dans les deux sens [8]. Effacer les données de Chrome efface aussi celles de la PWA [8].
- **Règle des 7 jours de Safari.** Safari efface le stockage écrit par script (`localStorage`, IndexedDB, service worker, cookies créés en JavaScript) d'un site sans interaction depuis 7 jours d'usage de Safari [4][5]. Les cookies posés par le serveur y échappent [6][11]. La web app de l'écran d'accueil en est exemptée [2][4].
- **Cookie `HttpOnly`.** Posé par le serveur, il n'est pas lisible par JavaScript (protection contre le vol par XSS) [12][13], et Safari ne plafonne pas sa durée pour un site de première partie [6]. Chrome plafonne la durée de tout cookie à 400 jours [10]. Le jeton en `localStorage` est lisible par tout script de la page, et soumis à la règle des 7 jours dans Safari.
- **iOS 26.** Tout site ajouté à l'écran d'accueil s'ouvre désormais comme une web app par défaut [7].
- **Liens.** Sur Android, un lien dans le `scope` de la PWA ouvre la PWA installée [8]. Sur iPhone, aucune source primaire ne décrit un tel mécanisme : un lien ouvert depuis l'appareil photo ou Safari s'ouvre dans le navigateur **[à tester]**.

## 1. iPhone : navigateur et web app de l'écran d'accueil

### 1.1 Stockage séparé

- Apple, WWDC 2023 : « Home Screen web apps have a standalone, app-like experience on iOS, with separate cookies and storage from the browser » [1].
- WebKit : « the website data of home screen web applications is kept isolated from Safari » [2].
- Conséquence directe : un cookie ou un `localStorage` posé pendant la visite dans Safari n'est pas lu par la web app, sauf copie à l'installation (§1.2). Une connexion faite ensuite dans Safari ne connecte pas la web app, et l'inverse [1].

### 1.2 Copie des cookies à l'installation

- **Mac (Safari 17, macOS Sonoma)** : « When a user adds a website to their Dock, Safari will copy the website's cookies to the web app » ; « Safari does not copy over any other kind of local storage » [3]. Apple conseille de garder l'état d'authentification dans les cookies, car le `localStorage` n'est pas copié [1].
- **iOS** : ni la session WWDC 2023 [1], ni l'annonce de Safari 17 [3], ni celle de Safari 26 [7] ne décrivent de copie. Apple présente la copie comme propre au Mac (« we copy website cookies when a web app on Mac is added to the Dock ») [1].
- Une page de démonstration tierce affirme : « iOS performs a one-time cookie copy at the moment the app is added to the home screen », sans version d'iOS **[secondaire]** [16]. Des fils de discussion plus anciens décrivent l'inverse selon les versions **[secondaire]**.
- Le comportement actuel d'iOS 26 est donc **[à tester]** : un cookie `HttpOnly` posé dans Safari est-il présent dans la web app juste après l'ajout ?

### 1.3 Ajout à l'écran d'accueil

- Depuis iOS 16.4, une web app de l'écran d'accueil peut demander l'autorisation des notifications push, en réponse à un geste de l'utilisateur. Il faut un manifeste avec `display` à `standalone` ou `fullscreen` [9].
- Depuis iOS 16.4, les navigateurs tiers (Chrome, Firefox, Edge sur iOS) peuvent proposer « Sur l'écran d'accueil » dans leur menu de partage [9]. La web app créée est la même que depuis Safari : elle tourne sur WebKit, avec son propre stockage [1].
- Depuis iOS 17, l'ajout est possible depuis `SFSafariViewController`, le navigateur intégré à certaines apps [3].
- Depuis iOS 26, « every website added to the Home Screen opens as a web app » par défaut. L'utilisateur peut décocher « Ouvrir comme web app » pour créer un simple signet, qui s'ouvre dans le navigateur par défaut [7].
- URL ouverte par l'icône : Apple indique que le système lit le manifeste au moment de l'ajout [17]. Des retours de développeurs indiquent que c'est `start_url` qui est ouverte, et non l'URL de la page en cours **[secondaire]** [18]. Avec le manifeste actuel, ce serait la racine du front office. **[à tester]**
- Union européenne : en février 2024, Apple avait annoncé le retrait des web apps de l'écran d'accueil dans l'UE avec iOS 17.4, puis y a renoncé avant la sortie **[secondaire]** [19].

### 1.4 Effacement automatique

**Dans Safari (le site ouvert dans un onglet)**

- Depuis Safari 13.1 (mars 2020), WebKit efface « all of a website's script-writable storage after seven days of Safari use without user interaction on the site » [4]. Sont concernés : IndexedDB, `localStorage`, `sessionStorage`, les enregistrements de service worker et leur cache [4][5]. Les cookies créés en JavaScript sont aussi effacés [5].
- Les 7 jours se comptent en jours d'usage de Safari, pas en jours calendaires [4].
- Depuis ITP 2.1 (février 2019), les cookies persistants créés par `document.cookie` ont une durée plafonnée à 7 jours [6].
- Les cookies posés par le serveur ne sont pas concernés : « Only cookies created through document.cookie are affected by this change » ; « authentication cookies should not be affected by the lifetime cap » [6]. MDN : « Cookies set by server are exempt from this eviction » [11].
- Exception : un cookie posé dans une réponse HTTP est plafonné à 7 jours si le serveur se cache derrière un CNAME tiers ou une adresse IP tierce [5]. Notre API est servie par la même origine et le même serveur que le front office : elle n'est pas dans ce cas.
- Pour une convention d'un week-end, la règle des 7 jours touche surtout la durée entre un premier passage (par exemple la veille) et le jour J. Elle ne touche pas un usage continu sur deux jours.

**Dans la web app de l'écran d'accueil**

- « The first-party domain of home screen web applications is exempt from ITP's 7-day cap on all script-writeable storage, i.e. ITP always skips that domain in its website data removal algorithm » [2]. Le compteur de jours de la web app est le sien, et se remet à zéro à chaque usage [4].
- Depuis iOS 17, la politique de stockage de WebKit s'applique aussi : quota par origine, éviction de l'origine entière, par ordre « least-recently-used », en cas de dépassement du quota global, de manque d'espace disque, ou d'inactivité [14]. Les cookies et le cache HTTP n'y sont pas soumis [14].
- `navigator.storage.persist()` demande un stockage persistant. WebKit l'accorde « based on heuristics like whether the website is opened as a Home Screen Web App » [14]. Sans prompt, d'après MDN [11].
- Ce qui arrive aux données quand l'utilisateur supprime la web app de l'écran d'accueil : aucune source primaire trouvée. **[à tester]**

**Navigation privée**

- Chaque onglet privé de Safari a une session éphémère : cookies et stockage disparaissent à la fermeture de l'onglet, du navigateur ou au redémarrage [5]. Un pseudo créé dans un onglet privé est perdu à sa fermeture, s'il n'a pas été copié ailleurs.

## 2. Android

### 2.1 Chrome : stockage partagé

- Chrome installe la PWA sous forme de WebAPK, un vrai APK généré par un serveur de Google [8][15].
- « Chrome uses the current profile to store any data, and it will not be segregated away. Cookies are shared and active, any client side storage is accessible and the service worker is installed and ready to go » [8] (page de 2017).
- « if the user clears their Chrome profile, or chooses to delete site data, that will apply to the WebAPK as well » [8].
- Un lien dans le `scope` de la PWA, touché ailleurs sur le téléphone, ouvre la PWA installée plutôt qu'un onglet [8].
- Conséquence : un pseudo créé dans Chrome avant l'installation se retrouve dans la PWA, et l'ordre pseudo / installation n'a pas d'effet sur l'identité.

### 2.2 Samsung Internet et autres navigateurs

- Samsung Internet sait aussi installer une PWA comme WebAPK **[secondaire]**. Aucune source primaire trouvée sur le partage de son stockage avec la PWA installée.
- La page web.dev décrit le partage avec « the current profile » de Chrome [8] : rien n'indique qu'une PWA installée depuis Samsung Internet voie les cookies de Chrome, ni l'inverse. Si le QR code s'ouvre dans un navigateur et que l'installation se fait dans un autre, l'identité ne suivrait pas. **[à tester]** : quel navigateur ouvre le lien du QR code sur un Samsung (appareil photo, Google Lens) ?

### 2.3 Effacement

- Chrome ne fait pas d'effacement proactif comme Safari. En mode « best-effort », les données restent tant que l'origine est sous son quota, que l'appareil a de la place, et que l'utilisateur ne les efface pas [11].
- En cas de manque d'espace, le navigateur efface les origines les moins récemment utilisées, sauf celles en stockage persistant [11][20].
- Chrome accorde `persist()` sans prompt, selon l'engagement sur le site, son installation ou son ajout aux favoris, et l'autorisation des notifications [20].
- Depuis Chrome 104 (août 2022), un cookie ne peut pas expirer à plus de 400 jours [10].
- Mode navigation privée : les données disparaissent à la fin de la session privée [11].

## 3. Cookie `HttpOnly` ou jeton côté client

|                        | Cookie `HttpOnly` posé par l'API                                                                             | Jeton en `localStorage` ou IndexedDB                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Lisible par JavaScript | Non : « Forbids JavaScript from accessing the cookie » [12]                                                  | Oui, par tout script de la page [13]                                                      |
| Vol par XSS            | Le cookie ne peut pas être lu, mais un script injecté peut encore faire des requêtes avec lui [12]           | « A single Cross Site Scripting can be used to steal all the data in these objects » [13] |
| Envoi à l'API          | Automatique avec `fetch()` sur la même origine [12]                                                          | À ajouter dans un en-tête par le front                                                    |
| Safari, onglet         | Pas de plafond de 7 jours pour un cookie serveur de première partie [6][11]                                  | Effacé après 7 jours d'usage de Safari sans interaction [4]                               |
| Web app iOS            | Exempt de la règle des 7 jours [2] ; hors quota [14]                                                         | Exempt de la règle des 7 jours [2] ; soumis au quota et à l'éviction [14]                 |
| Copie Safari → web app | Documentée sur Mac seulement [1][3] ; iOS **[à tester]**                                                     | Jamais copié [1][3]                                                                       |
| Android Chrome         | Partagé avec la PWA [8] ; 400 jours au plus [10]                                                             | Partagé avec la PWA [8]                                                                   |
| Hors ligne             | Illisible par le front : le pseudo affiché doit venir d'ailleurs (réponse d'API en cache, copie non secrète) | Lisible hors ligne                                                                        |

Autres faits utiles :

- OWASP : « Do not store session identifiers in local storage as the data is always accessible by JavaScript » [13].
- Le préfixe `__Host-` impose `Secure`, `Path=/` et l'absence de `Domain` : le cookie n'est envoyé qu'à l'hôte qui l'a posé [12]. Notre front office et notre API partagent l'hôte, ce qui le permet.
- `SameSite` : certains navigateurs appliquent `Lax` par défaut [12]. Avec une API sur la même origine, les appels du front sont de même site.
- Les deux approches ne s'excluent pas : un cookie `HttpOnly` pour l'authentification, et une copie non secrète (pseudo, identifiant affiché) dans le stockage du front pour l'affichage hors ligne.

## 4. Conséquences pour l'ordre du parcours d'accueil

Le PRD §4.2 prévoit : scan du QR code, « Avez-vous un code MJ ? », pseudo et code de récupération, puis ajout à l'écran d'accueil et notifications. Les faits ci-dessus donnent, par plateforme :

**Android (Chrome)** : le stockage étant partagé [8], un pseudo créé dans Chrome est présent dans la PWA installée ensuite. L'ordre est libre, à condition que l'installation se fasse depuis le même navigateur que la création du pseudo (§2.2).

**iPhone, pseudo d'abord dans Safari** (ordre actuel du PRD) :

- Le pseudo et sa session vivent dans le stockage de Safari.
- À l'ouverture de la web app, la session n'existe que si iOS copie les cookies à l'installation, ce qu'Apple ne documente pas pour iOS (§1.2). Le `localStorage` n'est jamais copié [1][3].
- Sans copie, le participant doit retrouver son identité dans la web app, par le code de récupération (ID-2) ou un autre moyen (§5).
- La session restée dans Safari continue d'exister. Elle y est soumise à la règle des 7 jours pour ce qui est écrit par script [4].
- Le push n'est possible que dans la web app [9] : l'abonnement doit être fait dans la web app, avec la session de la web app.

**iPhone, installation d'abord** :

- Le premier écran, dans Safari, guide l'ajout à l'écran d'accueil, sans créer d'identité.
- Le pseudo et le code de récupération sont créés dans la web app : l'identité vit directement dans le stockage qui durera, exempt de la règle des 7 jours [2].
- Le participant qui refuse ou rate l'installation reste dans Safari : il faut un chemin pour lui (identité dans Safari, sans push).
- Il faut savoir distinguer les deux contextes : `display-mode: standalone` (media query) ou `navigator.standalone` sur iOS. **[à tester]** sur iOS 26.

**Cas communs** :

- Un participant qui n'a pas d'iPhone récent, refuse l'installation, ou utilise la navigation privée garde son identité dans le navigateur, avec les limites du §1.4.
- Le MJ (ID-3) saisit son code MJ : il peut le faire dans n'importe quel contexte, et à nouveau dans la web app, puisque le code est réutilisable.

## 5. Moyens de transférer l'identité vers la web app

| Moyen                                                                  | Ce qui est établi                                                           | Limites                                                                                                                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code de récupération saisi dans la web app                             | Prévu par ID-2 et l'ADR 0001 ; ne dépend d'aucun comportement du navigateur | Saisie à la main ; le participant doit l'avoir noté ou copié. Le presse-papiers est partagé sur le téléphone : copier dans Safari et coller dans la web app est possible    |
| Copie des cookies par iOS à l'installation                             | Documentée sur Mac [1][3]                                                   | Non documentée sur iOS **[à tester]** ; ne copie pas le `localStorage`                                                                                                      |
| Lien de transfert (URL avec un jeton à usage unique)                   | Sur Android, un lien dans le `scope` ouvre la PWA installée [8]             | Sur iPhone, aucun mécanisme documenté pour qu'un lien ouvre la web app plutôt que le navigateur **[à tester]**. Un jeton dans l'URL peut fuir (historique, capture d'écran) |
| `start_url` contenant un jeton (manifeste propre à chaque participant) | Le manifeste est lu au moment de l'ajout [17]                               | Dépend de `start_url` réellement retenu par iOS **[à tester]** ; manifeste dynamique, à l'opposé du manifeste statique actuel ; le jeton resterait dans l'icône             |
| Lien MJ / code MJ                                                      | ID-3 : code MJ réutilisable, qui sert de code de récupération               | Ne concerne que les MJ                                                                                                                                                      |

## 6. Questions ouvertes

Pour **#47** (session et codes) :

1. Session par cookie `HttpOnly`, par jeton côté client, ou les deux (cookie pour l'API, copie non secrète pour l'affichage hors ligne) ?
2. Durée de la session : la convention dure un week-end ; un participant peut-il ouvrir l'application avant le jour J (règle des 7 jours dans Safari) ?
3. Le code de récupération est-il le seul moyen de transfert vers la web app sur iPhone, ou prévoit-on un lien ou un jeton à usage unique ?
4. Que devient la session de Safari quand l'identité est reprise dans la web app : deux sessions actives pour le même participant, ou la nouvelle remplace l'ancienne ?
5. Demande-t-on `navigator.storage.persist()` dans la web app ?
6. Combien de sessions par participant (téléphone perdu, deuxième appareil) ?

Pour **#50** (parcours d'accueil) :

1. Sur iPhone, installation d'abord ou pseudo d'abord ? Si pseudo d'abord, comment la web app retrouve-t-elle l'identité à sa première ouverture ?
2. Le parcours diffère-t-il entre iPhone et Android, puisque l'ordre n'a pas d'effet sur Android ?
3. Que propose-t-on à qui n'installe pas (refus, ancien iOS, navigation privée) ?
4. Comment l'écran de Safari sait-il que la web app est déjà installée, pour ne pas faire créer un second pseudo ?
5. Le QR code de la salle doit-il pointer vers une page d'accueil distincte de `start_url` ?

**Tests à faire sur appareil**, avant de trancher :

- iOS 26 : un cookie `HttpOnly` posé dans Safari est-il présent dans la web app juste après l'ajout ? Et un cookie non `HttpOnly` ?
- iOS 26 : quelle URL ouvre l'icône (page en cours ou `start_url`) ?
- iOS 26 : un lien du `scope`, ouvert depuis l'appareil photo ou Messages, ouvre-t-il la web app ou Safari ?
- iOS : les données de la web app survivent-elles à sa suppression puis à un nouvel ajout ?
- Android Samsung : quel navigateur ouvre le QR code, et une PWA installée depuis Samsung Internet partage-t-elle son stockage avec lui ?

## Sources

1. Apple, WWDC 2023, « What's new in web apps » (session 10120), transcription. https://developer.apple.com/videos/play/wwdc2023/10120/
2. WebKit, « Tracking Prevention in WebKit », section « Home Screen Web Application Domain Exempt From ITP ». https://webkit.org/tracking-prevention/
3. WebKit, « WebKit Features in Safari 17.0 », septembre 2023. https://webkit.org/blog/14445/webkit-features-in-safari-17-0/
4. WebKit, « Full Third-Party Cookie Blocking and More », 24 mars 2020 (Safari 13.1, iOS 13.4). https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
5. WebKit, « Tracking Prevention in WebKit », sections « 7-Day Cap on All Script-Writeable Storage », « CNAME and Third-Party IP Address Cloaking Defense », « Private Browsing ». https://webkit.org/tracking-prevention/
6. WebKit, « Intelligent Tracking Prevention 2.1 », 21 février 2019. https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/
7. WebKit, « News from WWDC25: Web technology coming this fall in Safari 26 beta », 9 juin 2025. https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/
8. web.dev, « WebAPKs on Android », mise à jour du 21 mai 2017. https://web.dev/articles/webapks
9. WebKit, « Web Push for Web Apps on iOS and iPadOS », 16 février 2023. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
10. Chrome for Developers, « Cookie Expires and Max-Age attributes now have upper limit », août 2022 (Chrome 104). https://developer.chrome.com/blog/cookie-max-age-expires
11. MDN, « Storage quotas and eviction criteria », modifiée le 5 janvier 2026. https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
12. MDN, « Set-Cookie ». https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
13. OWASP, « HTML5 Security Cheat Sheet », section « Local Storage ». https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
14. WebKit, « Updates to Storage Policy », 10 août 2023 (Safari 17, iOS 17). https://webkit.org/blog/14403/updates-to-storage-policy/
15. Chromium, « Android Web App Architectures (WebAPK and TWA) ». https://chromium.googlesource.com/chromium/src/+/main/components/webapps/docs/android_architecture.md
16. **[secondaire]** Progressier, « Cookies PWA Demo ». https://progressier.com/pwa-capabilities/cookies-demo
17. Apple Developer Documentation, `SFAddToHomeScreenActivityItem`. https://developer.apple.com/documentation/safariservices/sfaddtohomescreenactivityitem
18. **[secondaire]** D. Copeland, « Getting 'Save to Home Screen' to Kinda Work on iOS », 24 août 2023. https://naildrivin5.com/blog/2023/08/24/braindump-of-pwa-on-ios.html
19. **[secondaire]** 9to5Mac, « Apple reverses course on Home Screen web apps in the EU », 1er mars 2024. https://9to5mac.com/2024/03/01/apple-home-screen-web-apps-ios-17-eu/
20. web.dev, « Persistent storage », mise à jour du 12 mai 2020. https://web.dev/articles/persistent-storage
