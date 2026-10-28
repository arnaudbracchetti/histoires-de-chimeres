# Labo : mini application de test pour iPhone et Android

**PROTOTYPE jetable.** Branche `prototype/labo-telephones`, jamais fusionnée. Outil de [#59](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/59), qui sert à [#53](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/53), à [#60](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/60) et à [#61](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/61).

Même pile que la cible : Angular 22 et son service worker, NestJS, `web-push` 3.6.7 pour chiffrer et signer, envoi par `fetch` (ADR 0010). L'état (téléphones, journaux, envois, constats) est recopié toutes les 5 s dans un fichier JSON, sur le volume `labo_data` : un redéploiement le garde. Un téléphone renvoie son abonnement à chaque ouverture.

En ligne : <https://test.nekbet.fr>. Pilotage : <https://test.nekbet.fr/pilotage>, avec la clé `LABO_CLE` du `.env` du serveur (`ssh deploy@ovh grep LABO_CLE chimeres-labo/.env`).

## Protocoles du pilotage

Le pilotage porte aussi des protocoles pas à pas (`src/app/protocols.ts`) : pour chaque étape, les gestes à faire sur le téléphone, ce qu'il faut noter, les lignes du journal qui la concernent, et la saisie du résultat (oui, non, partiel, pas fait, et une note). « Copier en Markdown » produit le texte de résolution du ticket.

- **iPhone : stockage, push et arrière-plan** ([#60](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/60)) : ce que voit Safari avant l'installation, libellés de l'ajout à l'écran d'accueil, cookie et code du QR dans la web app (manifestes A et B), lien depuis Messages, refus puis réactivation dans les Réglages (abonnement sans tap), délai de livraison, tap selon le format (double, ou Angular seul comme un iOS avant 18.4), bannière au premier plan, titres, remplacement par `tag` et par `Topic` hors ligne, geste de retour, arrière-plan, programme hors ligne. Il remplace, pour l'iPhone, le déroulé ci-dessous.
- **Android : installer depuis la page et passer dans l'application** ([#61](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/61)) : `beforeinstallprompt` et son retour après « Annuler », `appinstalled`, menu ⋮ de Chrome, ouverture de l'application depuis Chrome (lien, nouvel onglet, `intent://`), `display-mode`, `getInstalledRelatedApps`.

## Déroulé des tests

Le pilotage ouvert sur l'ordinateur, le téléphone en 4G. Dans « Constats », ajouter l'appareil (modèle, OS et version exacte, navigateur), puis remplir la case de chaque vérification au fil des étapes.

1. **Navigateur.** Scanner le QR A. Donner un nom au téléphone (« iPhone 15 Safari »). « Poser le cookie ».
2. **Installation.** Sur Android, essayer d'abord le bouton « Installer » de la section Installation (`beforeinstallprompt` ; il n'apparaît pas si l'app est déjà installée). Sinon, ajouter à l'écran d'accueil (iPhone : Partager → Sur l'écran d'accueil ; Android : menu → Installer). Ouvrir l'app installée. Lire : cookie reçu ou non, code lu à la 1re ouverture, identifiant « créé à cette ouverture » ou non (stockage séparé). Nommer ce contexte (« iPhone 15 web app »).
3. **Manifeste B** (iPhone surtout). Supprimer l'app, scanner le QR B, réinstaller, regarder le code lu à la 1re ouverture.
4. **Lien.** Envoyer l'adresse du labo par message, la toucher : s'ouvre-t-elle dans l'app installée ?
5. **Abonnement**, dans l'app installée : « S'abonner (SwPush) ». S'il échoue, essayer les autres boutons. Noter celui qui marche.
6. **Push, app fermée.** Fermer l'app (balayer). Pilotage : modèle « Nouvelle partie », délai 10 s, Envoyer. Noter le délai (« Vu par le worker », ou l'heure affichée par le téléphone), puis toucher la notification : la page dit par quel chemin elle s'est ouverte.
7. **Push, app au premier plan.** Même envoi, app ouverte : la bannière s'affiche-t-elle ? Toucher : quelle page, quel chemin ?
8. **Titres.** Envoyer « Titre le plus long » et deux ou trois autres modèles, écran verrouillé puis centre de notifications. Noter où le titre se coupe (le pilotage compte les caractères).
9. **Remplacement en ligne.** « Nouvelle partie », 2 envois, intervalle 10 s, `tag` et `Topic` laissés. La 2e remplace-t-elle la 1re, sans nouveau son ?
10. **Remplacement hors ligne.** Mode avion. Même envoi (2 fois, 10 s). Attendre 30 s, couper le mode avion : n'arrive-t-il que la 2e ?
11. **Retour.** « Empiler des écrans », 3 fois « Écran suivant », puis le bouton retour d'Android ou le geste du bord gauche de l'iPhone.
12. **Arrière-plan.** Retour à l'accueil du labo, verrouiller le téléphone 5 min, revenir. Le journal dit combien de temps la minuterie s'est arrêtée et quand le flux SSE a été coupé (le côté serveur le note aussi).
13. **Hors ligne.** « Programme hors ligne » avec du réseau, puis mode avion, fermer l'app, la rouvrir sur cette page : elle s'affiche avec l'heure de la dernière lecture.

À la fin : « Copier en Markdown » et coller le texte en commentaire de résolution de #53.

## Ce que montre le téléphone (`/`)

| Section | Vérification de #53 |
|---|---|
| Ce téléphone | contexte (navigateur ou web app), identifiant du stockage local (« créé à cette ouverture » : stockage vide), agent |
| Ouverture et code de présence | URL de cette ouverture et de la première, code lu dans `?code=` |
| Installation | `display-mode`, chaque `beforeinstallprompt` et son délai après l'ouverture, `appinstalled`, applis liées (`getInstalledRelatedApps`, avec le `related_applications` du manifeste A), bouton « Installer » |
| Passer dans l'application | trois liens vers l'accueil (même onglet, nouvel onglet, `intent://`), marqués par `?ouvert-par=` |
| Cookie HttpOnly | le serveur pose un cookie de 400 jours et dit s'il le reçoit, et d'où il vient |
| Notifications | prise en charge, permission, trois façons de s'abonner (`SwPush`, `pushManager` du worker, `window.pushManager` sur Safari 18.4+) ; une case pour s'abonner sans tap, à l'ouverture et au retour au premier plan (réactivation dans les Réglages) |
| Retour et hors ligne | `/ecran/1` empile des écrans (`pushState`) ; `/hors-ligne` lit `/api/programme` en `freshness` (3 s, 7 jours) |
| Arrière-plan | minuterie d'une seconde et flux SSE : le journal note les trous et les coupures |
| Journal | tout ce qui précède, remonté aussi au pilotage |

Un tap sur une notification ouvre `/arrivee?n=…&via=…` : `via=navigate` (format déclaratif, Safari) ou `via=onActionClick` (service worker d'Angular).

Les deux QR codes du pilotage ouvrent `/?code=LABO42`, avec le manifeste normal (`start_url`) ou le manifeste B (`?manifeste=b`, sans `start_url`).

## Ce que fait le pilotage (`/pilotage`, sur ordinateur)

- envoie un des textes de NO-2 (`docs/prd.md` §5.6), modifiable, aux téléphones choisis ;
- règle le format (double, Angular seul, déclaratif seul), `mutable`, `tag`, `Topic`, `Urgency`, `TTL`, un délai avant l'envoi (le temps de fermer l'app ou de couper le réseau), et une répétition (deux « nouvelle partie » d'un même créneau) ;
- montre pour chaque envoi : la réponse du service push, l'heure où le service worker l'a vu passer (`sw-labo.js`), l'heure du tap et son chemin ;
- montre le journal de chaque téléphone, côté téléphone et côté serveur ;
- déroule les protocoles (voir plus haut), avec un résultat par étape.

Sur iPhone, Safari et la web app de l'écran d'accueil ont chacun leur stockage : ils apparaissent comme deux téléphones.

`sw-labo.js` charge `ngsw-worker.js` tel quel et ajoute un écouteur `push`, qui signale au serveur l'arrivée d'un message. Un message déclaratif sans `mutable` ne passe pas par le worker : il n'apparaît pas dans « Vu par le worker ».

## En local

```bash
# .env (ignoré par git) : clés VAPID, LABO_CLE, LABO_ORIGINE=http://localhost:3000
pnpm --filter labo build && pnpm --filter labo start   # http://localhost:3000
```

Le push ne part pas d'un navigateur sans HTTPS ni vrai service push : tester sur `test.nekbet.fr`.

## Déploiement

Image construite en local, passée par `ssh`, servie par le Caddy « edge » du VPS (`/opt/edge`). Aucun registre.

```bash
docker build -f apps/labo/Dockerfile -t chimeres-labo .
docker save chimeres-labo:latest | gzip | ssh deploy@ovh 'gunzip | docker load'

# Une fois : dossier, compose, .env et site Caddy
ssh deploy@ovh 'mkdir -p ~/chimeres-labo'   # /opt demande sudo
scp apps/labo/docker-compose.labo.yml deploy@ovh:chimeres-labo/
ssh deploy@ovh 'cd ~/chimeres-labo && docker run --rm chimeres-labo node -e "
  const k = require(\"web-push\").generateVAPIDKeys();
  console.log(\"VAPID_PUBLIC_KEY=\" + k.publicKey);
  console.log(\"VAPID_PRIVATE_KEY=\" + k.privateKey);
  console.log(\"VAPID_SUBJECT=https://test.nekbet.fr\");
  console.log(\"LABO_ORIGINE=https://test.nekbet.fr\");
  console.log(\"LABO_CLE=\" + require(\"crypto\").randomBytes(9).toString(\"base64url\"));
" > .env'
scp apps/labo/labo.caddy deploy@ovh:/opt/edge/sites/chimeres-labo.caddy
ssh deploy@ovh 'docker compose -f /opt/edge/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile'

# À chaque nouvelle image
ssh deploy@ovh 'cd ~/chimeres-labo && docker compose -f docker-compose.labo.yml up -d --force-recreate'
```

Les clés VAPID restent sur le serveur : en changer invalide tous les abonnements.

Pour tout retirer : `docker compose -f docker-compose.labo.yml down` dans `~/chimeres-labo`, supprimer `/opt/edge/sites/chimeres-labo.caddy`, recharger Caddy, `docker image rm chimeres-labo`.
