# Bonnes pratiques du lien magique

Recherche menée pour le ticket [#166](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/166), sous-ticket de la carte #159 « Habilitations du back office et protection de l'API ». Elle prépare le ticket #165 (« Lien magique et session du back office »), qui tranchera en HITL : ce document rassemble des faits, il ne tranche pas.

État au 11 novembre 2026. Textes examinés : NIST SP 800-63B-4 (version finale de 2025), OWASP ASVS 5.0, OWASP Cheat Sheet Series (version en ligne), documentation Microsoft Defender for Office 365 (mise à jour du 29 octobre 2026), code source d'Auth.js (branche `main`).

## Question

Que recommandent les sources de référence pour un lien magique, c'est-à-dire un lien de connexion envoyé par email (PRD ID-6) : entropie du jeton, hachage en base, durée de vie, usage unique, scanners d'email qui ouvrent les liens, énumération des emails, limite de demandes, liaison au navigateur qui a fait la demande, et session qui suit (durée, cookie, CSRF, rotation) ?

Contexte : quelques dizaines de comptes (MJ et Organisateurs), identifiés par email, sur le back office (`/gestion/`), servi par la même origine que l'API (`/api`). Le mot « session » désigne ici la session technique du navigateur, pas un créneau (le glossaire exclut « session » au sens métier).

## Méthode

- **Sources primaires** : normes (NIST SP 800-63B-4, OWASP ASVS 5.0), guides OWASP, documentation officielle de Microsoft, d'Angular, de Supabase et de Stytch, code source d'Auth.js. Une discussion GitHub de Supabase sert de retour d'expérience ; elle est marquée **[secondaire]**.
- Chaque exigence est citée avec son numéro (section NIST, identifiant ASVS) et son niveau d'obligation (SHALL, SHOULD, niveau ASVS L1 à L3).
- Aucune source ne traite le lien magique comme sujet à part entière. Les règles applicables viennent de trois familles voisines : l'authentification hors bande (out-of-band), les codes de récupération envoyés par email, et la réinitialisation de mot de passe par lien. Le document dit chaque fois de laquelle il s'agit.

## Résumé des faits

1. **Le NIST interdit l'email comme authentificateur hors bande** (« Email SHALL NOT be used for out-of-band authentication », §3.1.3.1). L'ASVS 5.0 l'interdit aussi, mais au niveau L3 seulement (6.3.6). Il autorise en revanche l'envoi par email d'un code de récupération, y compris sous forme de lien https, valable 24 h au plus (§4.2.1.2). Un lien magique est donc, au regard de ces normes, un mécanisme de faible assurance : le compte vaut ce que vaut la boîte mail.
2. **Jeton** : tiré par un générateur cryptographique (ASVS 6.5.3, OWASP), à usage unique (ASVS 6.5.1, NIST §3.1.3.2), d'une entropie d'au moins 20 bits pour un code saisi (ASVS 6.5.4), 64 bits « à envisager » (ASVS 6.6.3). À partir de 112 bits, un simple hachage (SHA-256) suffit pour le stockage en base (ASVS 6.5.2). Auth.js tire 256 bits et stocke un SHA-256.
3. **Durée de vie** : 10 minutes pour une authentification hors bande (NIST §3.1.3.2, ASVS 6.5.5), 24 heures pour un code de récupération envoyé par email (NIST §4.2.1.2). Auth.js prend 24 heures par défaut.
4. **Scanners d'email** : Microsoft Safe Links analyse les liens avant la remise du message, et « fait exploser » en arrière-plan ceux qui n'ont pas de réputation. Un lien qui consomme le jeton sur un simple `GET` peut donc être brûlé avant que la personne ne l'ouvre. Parades documentées : une page intermédiaire avec un bouton (Supabase), un code à saisir au lieu d'un lien (Supabase), la détection des robots (Stytch, propriétaire).
5. **Énumération** : même message et même temps de réponse que l'email existe ou non (OWASP Authentication et Forgot Password, ASVS 6.3.8 en L3).
6. **Limite de demandes** : OWASP demande une limite par compte (ou un CAPTCHA) sur la demande de lien ; le NIST plafonne à 100 les échecs consécutifs sur un authentificateur (§3.2.2).
7. **Liaison au navigateur** : l'ASVS 6.6.2 (L2) veut qu'un jeton hors bande soit lié à la demande qui l'a produit. Stytch le fait par PKCE, au prix d'un échec quand le lien s'ouvre dans un autre navigateur.
8. **Session** : identifiant opaque d'au moins 64 bits (NIST §5.1) ou 128 bits (ASVS 7.2.3), renouvelé à la connexion (ASVS 7.2.4), invalidé côté serveur à la déconnexion (ASVS 7.4.1). Cookie `Secure`, `HttpOnly`, `SameSite=Lax` ou `Strict`, préfixe `__Host-` et `Path=/` (NIST §5.1.1, ASVS 3.3, OWASP). Durée : 30 jours au plus en AAL1 (NIST), 4 à 8 h absolues pour un poste de travail (OWASP).
9. **CSRF** : `SameSite` ne suffit pas seul selon OWASP ; il faut un jeton, un en-tête personnalisé, ou la vérification de `Sec-Fetch-Site` / `Origin`. Angular sait envoyer un jeton `X-XSRF-TOKEN` si le serveur pose le cookie et le vérifie.

## 1. Statut du lien magique dans les normes

### NIST SP 800-63B-4

- §3.1.3.1 : « Email SHALL NOT be used for out-of-band authentication because it may be vulnerable to: access using only a password, interception in transit or at intermediate mail servers, rerouting attacks, such as those caused by Domain Name System (DNS) spoofing » [1].
- Même section : « Confirmation codes that are sent to validate email addresses or are issued as recovery codes (see Sec. 4.2.1.2) are not authentication processes and not affected by the above prohibition » [1].
- §4.2.1.2 (codes de récupération émis) : le code « SHALL include at least six decimal digits (or equivalent) » d'un générateur approuvé ; il peut être présenté comme « a secure (e.g., https) link with a representation of the recovery code » ; il est valable au plus « 24 hours when sent to an email address » ; sa vérification suit les limites de tentatives du §3.2.2 [1].

En clair : le NIST ne range pas le lien magique parmi les authentificateurs, mais il admet qu'un lien envoyé par email serve à récupérer un compte. Une application qui se connecte uniquement par lien magique fait, dans les faits, de chaque connexion une récupération de compte.

### OWASP ASVS 5.0

- 6.3.6 (L3) : « Verify that email is not used as either a single-factor or multi-factor authentication mechanism » [2].
- Introduction du §6.6 : « Unsafe out-of-band authentication mechanisms such as e-mail and VOIP are not permitted » [2].
- Le chapitre renvoie à la FAQ du NIST, selon laquelle l'email est « not acceptable » comme mécanisme d'authentification [2].

L'exigence chiffrée (6.3.6) est de niveau 3, le niveau des applications les plus sensibles. Les niveaux 1 et 2 ne l'imposent pas.

### OWASP Cheat Sheets

Le guide « Authentication » ne mentionne pas le lien magique ; sa section sur l'authentification sans mot de passe ne traite que d'OAuth, OIDC, SAML et FIDO [3]. Le guide le plus proche est « Forgot Password », qui décrit un lien envoyé par email contenant un jeton [4].

## 2. Le jeton

### Génération et entropie

| Source | Exigence |
|---|---|
| OWASP Forgot Password [4] | « Randomly generated using a cryptographically safe algorithm », « Sufficiently long to protect against brute-force attacks ». Aucun chiffre. |
| ASVS 6.5.3 (L2) [2] | Codes hors bande tirés par un CSPRNG. |
| ASVS 6.5.4 (L2) [2] | Au moins 20 bits d'entropie (« typically 4 random alphanumeric characters or 6 random digits »). Vise un code saisi à la main. |
| ASVS 6.6.3 (L2) [2] | Limite de tentatives contre la force brute ; « Consider also using a code with at least 64 bits of entropy ». |
| NIST §4.2.1.2 [1] | Code de récupération émis : au moins six chiffres décimaux, ou l'équivalent. |
| Auth.js (code) [5] | `randomString(32)` : 32 octets tirés par `crypto.getRandomValues`, soit 256 bits, en hexadécimal. |

Un jeton placé dans une URL n'est pas saisi à la main : sa longueur ne coûte rien à la personne. Les minima de 20 bits et de six chiffres visent les codes tapés au clavier.

### Stockage en base

- ASVS 6.5.2 (L2) : un secret de moins de 112 bits se stocke avec un algorithme de hachage de mot de passe et un sel de 32 bits ; « A standard hash function can be used if the secret has 112 bits of entropy or more » [2].
- NIST §4.2.1.1 : les codes de récupération enregistrés se stockent « in hashed form using an approved one-way function » [1].
- OWASP Forgot Password dit « Stored securely » sans préciser [4].
- Auth.js stocke `SHA-256(jeton + secret)`, où `secret` est le secret de l'application ; le jeton en clair ne part que dans l'email [5].

Avec un jeton de 112 bits ou plus, la base garde un SHA-256 et retrouve la ligne par ce hachage. Une fuite de la base ne donne alors aucun lien utilisable.

### Usage unique et durée de vie

- NIST §3.1.3.2 : « the authentication SHALL be considered invalid unless completed within 10 minutes. Verifiers SHALL accept a given authentication secret as valid only once during the validity period » [1].
- ASVS 6.5.1 (L2) : les codes hors bande « are only successfully usable once ». ASVS 6.5.5 (L2) : « Out of band requests must have a maximum lifetime of 10 minutes » [2].
- NIST §4.2.1.2 : 24 heures au plus pour un code de récupération envoyé par email [1].
- OWASP Forgot Password : « Single use and expire after an appropriate period », sans chiffre. Après une récupération, invalider les sessions et les liens encore valables [4].
- Auth.js : 24 heures par défaut (`ONE_DAY_IN_SECONDS`, réglable par `maxAge`), jeton supprimé à l'usage (`useVerificationToken`) [5].

Les deux familles de règles donnent donc 10 minutes (authentification) ou 24 heures (récupération). Aucune source ne parle des emails qui arrivent en retard ou des personnes qui ouvrent leur boîte plus tard.

### Construction de l'URL

OWASP Forgot Password, section « URL Tokens » [4] :

- ne pas construire l'URL à partir de l'en-tête `Host` de la requête (sinon un attaquant fait envoyer à sa victime un lien vers son propre domaine) : l'URL est fixée en configuration ou vérifiée contre une liste de domaines ;
- servir le lien en HTTPS ;
- poser `Referrer-Policy: no-referrer` sur la page d'arrivée, pour que le jeton ne fuie pas vers des ressources tierces.

## 3. Les scanners d'email

### Ce que fait Microsoft Safe Links

Documentation Microsoft Defender for Office 365 [6] :

- « Safe Links provides URL scanning and rewriting of inbound email messages during mail flow, and time-of-click verification ».
- « As long as Safe Links protection is turned on, URLs are scanned prior to message delivery, regardless of whether the URLs are rewritten or not. »
- « URLs that don't have a valid reputation are detonated asynchronously in the background. »
- Réglage recommandé « Wait for URL scanning to complete before delivering the message » : le message attend la fin de l'analyse.
- La politique « Built-in protection » s'applique par défaut à toute organisation qui a au moins une licence Defender for Office 365.

Microsoft ne dit pas quelle requête HTTP part (méthode, exécution du JavaScript). Le fait établi : le lien est visité par un robot avant la remise, et un nouveau domaine sans réputation a toutes les chances d'être « détoné ». Les autres produits du même type (Mimecast, Proofpoint, Barracuda…) n'ont pas été examinés ici.

Même page, à propos de Teams : un site dont le cookie d'authentification est `SameSite=Strict` peut redemander la connexion, car la page intermédiaire de Safe Links rend la navigation intersite [6]. Ce point vaut pour toute réécriture de lien.

### Ce qu'en disent les fournisseurs d'authentification

- **Supabase** (documentation, section « Email prefetching ») : certains scanners ouvrent les liens, et le lien de confirmation « will be consumed instantly ». Parades proposées : envoyer un code à saisir (`{{ .Token }}`) au lieu du lien, ou envoyer un lien vers une page qui affiche un bouton, lequel porte le vrai lien de confirmation [7].
- **Stytch** : un scanner « will end up consuming the token before the email actually makes its way into the user's inbox ». Stytch reconnaît les clics de robots par son produit de détection d'appareils et ne les compte pas comme tentatives de connexion [8]. Cette parade est propriétaire.
- **[secondaire]** Discussion GitHub de Supabase (#41618) : le problème touche surtout les entreprises, universités et hôpitaux. Une personne propose de placer le lien dans le fragment (`#…`) d'une page intermédiaire, au motif que « URL fragments are not fetched by scanners », puis de ne poursuivre qu'après un clic sur « Continuer » [9]. Aucune réponse de Supabase.

### Les parades, et leurs limites

| Parade | Principe | Limite |
|---|---|---|
| Page intermédiaire + `POST` | Le `GET` du lien affiche une page avec un bouton « Se connecter » ; seul le `POST` du formulaire consomme le jeton. | Repose sur le fait que les scanners ne soumettent pas les formulaires. Aucune source primaire ne le garantit. Un envoi automatique en JavaScript annulerait la parade. |
| Jeton dans le fragment | Le navigateur n'envoie jamais le fragment au serveur ; la page le lit et le poste après un clic. | Un scanner qui exécute le JavaScript de la page le voit. Retour d'expérience seulement [9]. |
| Code à saisir | L'email contient un code que la personne recopie dans l'onglet qui l'a demandé. | Plus de friction ; un code court exige une limite de tentatives (ASVS 6.6.3). Le code lie de fait la connexion au navigateur demandeur. |
| Détection des robots | Ne pas consommer le jeton quand le visiteur ressemble à un scanner. | Heuristique, propriétaire chez Stytch [8]. |

La page intermédiaire a un autre effet : la personne voit ce qu'elle s'apprête à faire. L'ASVS 7.6.2 (L2) demande que la création d'une session exige « either the user's consent or an explicit action » [10], et le NIST parle d'« authentication intent » (§3.2.8) : une action explicite, comme un appui sur un bouton [1].

## 4. Énumération des emails et limite de demandes

### Énumération

- OWASP Authentication : réponse générique, quel que soit le cas ; exemple pour la récupération : « If that email address is in our database, we will send you an email to reset your password » [3].
- OWASP Forgot Password : « a consistent message for both existent and non-existent accounts », et un temps de réponse constant, par un traitement asynchrone ou en suivant le même chemin de code, sans sortie rapide [4].
- ASVS 6.3.8 (L3) : ni le message, ni le code HTTP, ni le temps de réponse ne doivent révéler l'existence d'un compte [2].

Envoyer l'email après la réponse HTTP (et non avant) évite que la durée d'envoi SMTP trahisse l'existence du compte.

### Limite de demandes

- OWASP Forgot Password : protéger la demande contre les envois automatisés, par exemple par « rate-limiting on a per-account basis » ou un CAPTCHA ; limiter aussi les tentatives sur les jetons d'URL [4].
- OWASP Authentication : le compteur d'échecs se rattache au compte plutôt qu'à l'adresse IP, et le blocage ne doit pas devenir un déni de service [3].
- NIST §3.2.2 : au plus 100 échecs consécutifs sur un authentificateur d'un compte ; des limites plus basses sont permises [1].

Avec un jeton de 256 bits, deviner un lien est hors de portée : la limite sert surtout à empêcher qu'on inonde une boîte mail (ou qu'on fasse payer des envois) en demandant des liens en boucle.

## 5. Liaison au navigateur qui a fait la demande

- ASVS 6.6.2 (L2) : « out-of-band authentication requests, codes, or tokens are bound to the original authentication request for which they were generated and are not usable for a previous or subsequent one » [2].
- Stytch propose un PKCE pour les liens magiques : le navigateur qui demande le lien garde un `code_verifier` et n'envoie que son hachage ; le lien ne marche que si le même navigateur présente le `code_verifier`. Échec documenté : quand le lien s'ouvre dans un autre contexte (navigateur natif au lieu de la webview), la personne doit redemander un lien [11].

Ce que la liaison empêche : qu'un lien intercepté (boîte partagée, transfert d'email, scanner) ouvre une session ailleurs, et la « connexion forcée » (login CSRF), où un attaquant envoie à sa victime un lien vers son propre compte. OWASP décrit ce risque pour les formulaires de connexion [12].

Ce qu'elle coûte : un lien demandé sur l'ordinateur mais ouvert sur le téléphone (ou dans un autre navigateur) ne marche plus.

## 6. La session qui suit

### Identifiant

- NIST §5.1 : secret de session « at least 64 bits », tiré par un générateur approuvé, produit en réponse directe à l'authentification, effacé à la déconnexion [1].
- ASVS 7.2.3 (L1) : jeton de référence d'au moins 128 bits, tiré par un CSPRNG [10]. OWASP Session Management : 64 bits d'entropie au minimum, 128 bits recommandés pour un identifiant maison [13].
- ASVS 7.2.4 (L1) et OWASP : nouvel identifiant à chaque authentification, l'ancien est détruit (protection contre la fixation de session) [10][13].

### Cookie

| Attribut | NIST §5.1.1 [1] | ASVS 5.0 [14] | OWASP [13] |
|---|---|---|---|
| `Secure` | HTTPS seulement | 3.3.1 (L1) | oui |
| `HttpOnly` | SHOULD | 3.3.4 (L2) | oui |
| `SameSite` | SHOULD `Lax` ou `Strict` | 3.3.2 (L2), « selon l'usage du cookie » | `Strict` de préférence, ou `Lax` |
| Préfixe `__Host-` et `Path=/` | SHOULD | 3.3.3 (L2), sauf cookie partagé avec d'autres hôtes | recommandé |
| Contenu | opaque, sans donnée personnelle en clair | — | — |
| Expiration du cookie | proche de la fin de session, mais « SHALL NOT be relied upon to enforce session timeouts » | — | délais appliqués côté serveur |

Le préfixe `__Host-` impose `Secure`, `Path=/` et l'absence de `Domain` [13]. Le cookie actuel du front office (`linked-phone`, `apps/api/src/front-office/http/linked-phone-cookie.ts`) est `HttpOnly`, `Secure`, `SameSite=Lax`, avec `Path=/api` : il ne prend pas le préfixe `__Host-`, qui interdirait ce chemin.

`SameSite=Strict` et l'email : un navigateur n'envoie pas un cookie `Strict` sur une navigation venue d'un autre site (lien d'un email, page de Safe Links [6]). Les appels `fetch` d'une page déjà chargée depuis notre origine, eux, l'emportent. Pour une application Angular dont seule l'API lit le cookie, `Strict` ne gêne donc que si le premier chargement de page a besoin de la session.

### Durées

- NIST, réauthentification [1] : en AAL1, délai global « SHOULD be no more than 30 days », délai d'inactivité facultatif ; en AAL2, 24 h au plus, et 1 h d'inactivité au plus. Un lien magique par email n'atteint pas l'AAL2 (§1).
- OWASP Session Management [13] : inactivité de 15 à 30 minutes pour une application à faible risque ; durée absolue de 4 à 8 heures pour une personne qui travaille une journée de bureau.
- ASVS 7.1.1, 7.3.1, 7.3.2 (L2) : les deux délais existent, sont documentés, et tout écart avec le NIST est justifié [10].
- NIST §5.1 : un « remember my browser » ne remplace pas une authentification [1].

### Fin de session

- ASVS 7.4.1 (L1) : à la déconnexion ou à l'expiration, la session est invalidée côté serveur [10]. OWASP : effacer le cookie ne suffit pas [13].
- ASVS 7.4.2 (L1) : un compte désactivé ou supprimé perd toutes ses sessions [10].
- ASVS 7.4.5 (L2) : un administrateur peut terminer les sessions d'une personne ou de toutes [10].
- ASVS 7.4.4 (L2) : la déconnexion est visible depuis chaque page authentifiée [10].

### CSRF

- OWASP CSRF : `SameSite` « does not replace a proper CSRF defense in most deployments ». Il peut suffire seul sous conditions : aucun domaine partagé avec des hôtes qu'on ne contrôle pas, aucun `GET` qui modifie l'état, cookie `Strict` (ou `Lax` avec `__Host-`), et vérification d'`Origin` / `Referer` en plus [12].
- OWASP CSRF : `Sec-Fetch-Site` comme signal principal pour refuser les `POST`, `PUT`, `PATCH`, `DELETE` intersites, avec repli sur `Origin` / `Referer` [12]. L'en-tête personnalisé sur les appels d'API fonctionne aussi, grâce au pré-vol CORS [12]. ASVS 3.5.1 et 3.5.3 (L1) disent la même chose [14].
- Angular `HttpClient` lit un cookie `XSRF-TOKEN` et le renvoie dans l'en-tête `X-XSRF-TOKEN` sur les requêtes qui modifient l'état vers la même origine. Le serveur doit poser le cookie et vérifier la concordance, sinon la protection « ne fait rien » [15].
- Connexion forcée : OWASP recommande un jeton dès le formulaire de connexion et un nouvel identifiant de session après la connexion [12].

## Ce que ça implique pour nous

Ce qui suit propose des options pour le ticket #165. Rien n'est tranché.

**Le niveau de sécurité est un choix déjà fait, à assumer.** ID-6 retient le lien magique. Le NIST et l'ASVS L3 ne le reconnaissent pas comme authentification ; l'ASVS L1 et L2 ne l'interdisent pas. Le compte d'un Organisateur vaut donc la sécurité de sa boîte mail. Un ADR pourrait l'écrire noir sur blanc, avec le niveau ASVS visé (L2 semble le plus proche).

**Points qui font consensus, sans vraie question ouverte :**

- jeton de 256 bits tiré par `crypto.randomBytes`, en base64url dans l'URL ;
- base : SHA-256 du jeton seulement, date de création, date d'expiration, date d'usage ; recherche par le hachage ;
- usage unique, et tous les liens encore valables d'un compte annulés à la connexion ;
- URL construite depuis le domaine public configuré, jamais depuis `Host` ;
- `Referrer-Policy: no-referrer` sur la page d'arrivée ; ne pas journaliser l'URL complète (journaux de Caddy et de NestJS) ;
- même réponse et même délai que l'email soit connu ou non ; email envoyé après la réponse ;
- session : identifiant opaque de 128 bits ou plus, stocké en base (haché ou non), nouveau à chaque connexion, invalidé en base à la déconnexion, à la désactivation du compte et à la fin de sa durée ;
- cookie `HttpOnly`, `Secure`, `SameSite=Lax` ou `Strict`, distinct de `linked-phone`.

**Questions à trancher :**

1. **Page intermédiaire avec bouton, ou lien direct ?** Le lien direct est le plus simple, mais un Organisateur derrière Microsoft 365 risque un lien déjà consommé. La page intermédiaire (le `GET` affiche « Se connecter en tant que *adresse* », le `POST` consomme le jeton) coûte un clic, et répond aussi à la connexion forcée et à l'« action explicite » de l'ASVS 7.6.2. Le code à saisir est une troisième voie, plus lourde.
2. **Durée de validité du lien.** 10 minutes (règle des authentificateurs hors bande), 15 à 60 minutes (compromis courant), ou 24 heures (règle des codes de récupération, défaut d'Auth.js). Le cas « l'Organisateur crée un compte MJ, le MJ ouvre l'email le lendemain » relève peut-être d'une invitation à part, avec sa propre durée.
3. **Lier le lien au navigateur demandeur ?** Plus sûr (ASVS 6.6.2), mais un MJ qui demande le lien sur son ordinateur et l'ouvre sur son téléphone échoue. Option intermédiaire : ne pas lier, mais afficher l'adresse du compte sur la page intermédiaire.
4. **Durée de session.** Deux pôles : une journée de travail (OWASP, 4 à 8 h absolues) ou jusqu'à 30 jours (plafond AAL1 du NIST). Le jour J, un Organisateur pilote toute la journée sur son portable : une session qui expire en plein tirage serait gênante. Un délai d'inactivité est à décider aussi, ainsi que le lien avec la fin de la convention (déjà noté dans #159).
5. **`Lax` ou `Strict`, `__Host-` ou `Path=/api` ?** `__Host-` impose `Path=/`, alors que le cookie `linked-phone` suit le choix `Path=/api`. `Strict` ne gêne pas les appels d'API d'une page Angular déjà chargée.
6. **Protection CSRF.** Options : vérifier `Sec-Fetch-Site` (repli sur `Origin`) dans un intercepteur NestJS sur toutes les méthodes non sûres, ou activer le couple `XSRF-TOKEN` / `X-XSRF-TOKEN` qu'Angular gère déjà. Les deux ensemble restent possibles. À décider aussi pour le front office, qui a le même problème avec `linked-phone`.
7. **Limite de demandes.** Par adresse email (par exemple quelques liens par quart d'heure) et par adresse IP. Rien n'existe dans l'API aujourd'hui : `@nestjs/throttler` ou un compteur en base sont deux pistes. Avec quelques dizaines de comptes, un compteur simple en base peut suffire.
8. **Connexion sans email en dev, en démo et dans les tests e2e** (point ouvert de #159) : la page intermédiaire et le jeton haché se testent bien si l'envoi passe par un port (`MagicLinkSender` ou autre) qu'on peut remplacer.

## Sources

1. NIST, SP 800-63B-4, « Digital Identity Guidelines: Authentication and Authenticator Management », 2025. §3.1.3.1, §3.1.3.2, §3.2.2, §3.2.8, §4.2.1, §5.1, §5.1.1, et exigences de réauthentification par AAL. https://pages.nist.gov/800-63-4/sp800-63b.html
2. OWASP, ASVS 5.0, chapitre V6 « Authentication ». https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md
3. OWASP Cheat Sheet Series, « Authentication Cheat Sheet ». https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
4. OWASP Cheat Sheet Series, « Forgot Password Cheat Sheet ». https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
5. Auth.js, code source : `packages/core/src/lib/actions/signin/send-token.ts` et `packages/core/src/lib/utils/web.ts`. https://github.com/nextauthjs/next-auth/tree/main/packages/core/src/lib ; documentation : https://authjs.dev/getting-started/authentication/email
6. Microsoft Learn, « Complete Safe Links overview for Microsoft Defender for Office 365 », mise à jour du 29 octobre 2026. https://learn.microsoft.com/en-us/defender-office-365/safe-links-about
7. Supabase, « Email Templates », section « Email prefetching ». https://supabase.com/docs/guides/auth/auth-email-templates
8. Stytch, « Protected Email Magic Links ». https://stytch.com/docs/b2b/guides/magic-links/protected-eml
9. **[secondaire]** Discussion GitHub Supabase #41618, « Magic links and password reset tokens consumed by email scanners in institutional environments ». https://github.com/orgs/supabase/discussions/41618
10. OWASP, ASVS 5.0, chapitre V7 « Session Management ». https://github.com/OWASP/ASVS/blob/master/5.0/en/0x16-V7-Session-Management.md
11. Stytch, « Adding PKCE to an Email Magic Links flow ». https://stytch.com/docs/consumer-auth/authentication/magic-links/adding-pkce
12. OWASP Cheat Sheet Series, « Cross-Site Request Forgery Prevention Cheat Sheet ». https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
13. OWASP Cheat Sheet Series, « Session Management Cheat Sheet ». https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
14. OWASP, ASVS 5.0, chapitre V3 « Web Frontend Security ». https://github.com/OWASP/ASVS/blob/master/5.0/en/0x12-V3-Web-Frontend-Security.md
15. Angular, « Security », section « HttpClient XSRF/CSRF security ». https://angular.dev/best-practices/security
