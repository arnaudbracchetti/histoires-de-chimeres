# PRD — Histoires de Chimères

Application d'inscription et de tirage au sort pour une convention de jeu de rôle.

Vocabulaire : voir [GLOSSARY.md](../GLOSSARY.md). Les termes en **gras** y sont définis.

## 1. Contexte et objectifs

L'association "Les tisseurs de chimères" organise une convention de jeu de rôle d'une journée. Des **MJ** proposent des **scénarios** ; les **Organisateurs** les **programment** sur des **créneaux** et des **tables** ; les **participants** s'inscrivent sur place aux **parties** qui les intéressent ; un **tirage** au sort répartit ensuite les inscrits sur les tables, créneau par créneau.

Objectifs :

- **Chaque participant inscrit sur un créneau doit pouvoir jouer.** C'est l'objectif principal du tirage, avant toute notion d'équité.
- **Brasser les participants** : pas d'inscription en groupe, le hasard mélange les tables.
- **Friction minimale** : pas de compte, pas d'email côté participant ; tout se fait sur le téléphone, sur place.
- **Prévenir chacun de sa table** par une notification sur son téléphone dès la publication du tirage.

Ordres de grandeur :

| | |
|---|---|
| Participants | 25 à 80 |
| Créneaux | 4 ou 5 dans la journée, de 2h30, séparés éventuellement par des pauses (repas…) |
| Parties par créneau | 3 à 5 |
| Réseau sur place | 4G / 5G uniquement, pas de Wi-Fi |

## 2. Profils

| Profil | Connu à l'avance ? | Identification | Interface |
|---|---|---|---|
| **Participant** | Non | **Pseudo** + **code de récupération** | Front office mobile (PWA) |
| **MJ** | Oui (email) | Back office : lien magique par email. Téléphone : **code MJ** | Back office (avant la convention) + front office mobile |
| **Organisateur** | Oui (email) | Lien magique par email | Back office, sur ordinateur portable, y compris le jour J |

Un MJ est aussi un participant : il peut jouer sur les créneaux où il ne mène pas. Une même personne peut être MJ et Organisateur ; elle n'a qu'un compte et un code MJ.

Choix d'identification : voir [ADR 0001](adr/0001-identification-par-pseudo-et-code-de-recuperation.md).

## 3. Les deux applications

- **Front office participants** — mobile d'abord, installable (PWA) pour recevoir les notifications. Utilisé par les participants et par les MJ (pour jouer, et pour savoir à quelle table ils mènent). Aucune fonction d'Organisateur.
- **Back office** — orienté ordinateur. Utilisé par les MJ pour proposer leurs scénarios avant la convention, et par les Organisateurs pour tout le reste, **y compris le pilotage du jour J** (surcharge, tirage, ajustements, publication).

## 4. Parcours

### 4.1 Préparation (avant la convention)

1. Un Organisateur renseigne la convention (nom, date), ses **créneaux** (heure de début, heure de fin) et ses **tables** (nom).
2. Il crée les MJ, chacun avec son **pseudo** (PR-12), puis les comptes MJ et Organisateurs (email). Chaque compte reçoit un **code MJ** personnel, distribué par les Organisateurs.
3. Le MJ se connecte au back office par lien magique, puis propose ses **scénarios** et ses **disponibilités** (les créneaux où il peut mener). Il peut modifier ses scénarios à tout moment ; il n'y a pas de validation par les Organisateurs. Un Organisateur peut aussi les saisir et les modifier à sa place (PR-13).
4. Les Organisateurs **programment** des scénarios sur un créneau et une table, dès avant la convention, ce qui crée des **parties**, ou les laissent en **réserve**. Le jour J, ils peuvent encore programmer une partie depuis la réserve (TI-6).

Le **programme** est consultable en lecture seule avant la convention (emplacement à décider, cf. §8).

### 4.2 Arrivée sur place

1. Le participant scanne le QR code affiché dans la salle : il ouvre l'application.
2. L'application demande « Avez-vous un code MJ ? »
   - **Oui** : il saisit son code MJ ; son pseudo, déjà enregistré, est récupéré et le téléphone est relié à son compte MJ.
   - **Non** : il choisit un pseudo (unique dans la convention, distinct des pseudos des MJ, qui sont réservés) et reçoit un **code de récupération** à conserver.
3. L'application le guide pour l'ajouter à l'écran d'accueil (indispensable sur iPhone) et accepter les notifications.

Tant que les inscriptions ne sont pas ouvertes, l'application affiche « Les inscriptions ouvriront le jour de la convention » et permet de consulter le programme.

### 4.3 Inscriptions

1. Le matin, un Organisateur déclenche l'**ouverture des inscriptions** depuis le back office.
2. Le participant parcourt les parties par créneau et consulte leur fiche (§5.3).
3. Il s'**inscrit** à autant de parties qu'il veut, y compris plusieurs sur le même créneau, et peut se désinscrire librement tant que le tirage du créneau n'est pas lancé.
4. S'il s'inscrit à une **partie très demandée**, l'application le prévient qu'il risque de ne pas être pris et l'incite à s'inscrire aussi à d'autres parties du créneau.

### 4.4 Pilotage d'un créneau (Organisateur, back office)

1. **Surveiller la surcharge** : le back office affiche en permanence, pour chaque créneau, *demande / capacité*, avec un code couleur dès que la demande dépasse la capacité.
2. **Soulager un créneau** : l'Organisateur programme une partie depuis la réserve. Les participants inscrits sur ce créneau reçoivent une notification « nouvelle partie disponible ».
3. **Lancer le tirage** : les inscriptions du créneau se ferment ; le tirage produit un résultat **provisoire**.
4. **Examiner et ajuster** : l'Organisateur voit les parties, leurs joueurs, les parties sous leur minimum et les **non placés**, et peut faire des **ajustements** (§5.5).
5. **Publier** : le résultat devient définitif et les notifications partent (§5.6).

### 4.5 Après la publication

Le tirage publié est figé. Les non placés vont voir les MJ des tables où il reste de la place ; ces mouvements ne sont pas suivis par l'application.

## 5. Exigences fonctionnelles

### 5.1 Identité

- **ID-1** Un participant s'identifie par un pseudo, unique dans la convention (ID-7), sans compte ni email.
- **ID-2** À la création du pseudo, l'application remet un code de récupération qui permet de retrouver son identité sur un autre appareil.
- **ID-3** Un MJ saisit son code MJ au lieu de créer un pseudo ; son pseudo, défini dans le back office, est récupéré. Le code MJ est réutilisable et lui sert aussi de code de récupération.
- **ID-4** Les pseudos des MJ sont réservés : un participant ne peut pas les prendre.
- **ID-5** Dans le back office, un Organisateur peut :
  - retrouver un participant par son pseudo et lui redonner son code de récupération (après l'avoir reconnu en personne) ;
  - relier ou délier un pseudo et un compte MJ ; lors d'une liaison, les inscriptions du pseudo provisoire sont reportées sur le compte MJ et le pseudo provisoire disparaît ;
  - supprimer un pseudo (doublon, abus).
- **ID-6** MJ et Organisateurs se connectent au back office par lien magique envoyé par email.
- **ID-7** Deux pseudos sont le même pseudo quand ils ne diffèrent que par la casse, les accents ou les espaces (au début, à la fin, ou plusieurs à la suite) : « Élodie » et « elodie » sont le même pseudo. La ponctuation compte : « Jean-Luc » et « Jean Luc » sont deux pseudos distincts. Un pseudo s'affiche tel qu'il a été saisi.

### 5.2 Programme

- **PR-1** Un scénario comporte :
  - un titre (80 caractères au plus, pas forcément unique) ;
  - un jeu, en texte libre (60 caractères au plus) ;
  - une présentation (1 500 caractères au plus), en Markdown restreint aux paragraphes, au gras, à l'italique et aux listes ;
  - une image facultative ;
  - des avertissements de contenu facultatifs, en texte libre (300 caractères au plus) ;
  - des places minimum et maximum, MJ non compris, avec 1 ≤ minimum ≤ maximum ;
  - une durée : un ou deux créneaux.

  Seuls le titre, le jeu, la présentation, les places et la durée sont obligatoires.
- **PR-2** Le MJ déclare ses disponibilités par créneau.
- **PR-3** Un Organisateur programme un scénario sur un créneau et une table ; un même scénario peut être programmé plusieurs fois.
- **PR-4** Une partie reprend les places de son scénario, et les suit quand il change. L'Organisateur peut lui fixer d'autres places, qu'elle garde alors quels que soient les changements du scénario, ou la ramener aux places du scénario.
- **PR-5** Contraintes de programmation :
  - une seule partie par table et par créneau ;
  - un MJ mène au plus une partie par créneau ;
  - une partie n'est programmée que sur un créneau où son MJ est disponible (les deux créneaux pour une partie double) ;
  - une partie double occupe la même table sur ses deux créneaux consécutifs.
- **PR-6** La réserve d'un créneau regroupe les scénarios dont le MJ est disponible sur ce créneau et n'y mène aucune partie (sur ce créneau et le suivant pour un scénario double), y compris ceux déjà programmés sur un autre créneau. Les participants ne voient que les parties programmées ; la réserve leur est invisible.
- **PR-7** L'image d'un scénario est redimensionnée et compressée par le serveur (ordre de grandeur : 100 Ko). Sans image, une illustration par défaut est affichée.
- **PR-8** Les créneaux ne se chevauchent pas (deux créneaux bout à bout sont permis). Un créneau est désigné par son rang dans la journée (« créneau 2 »). Deux créneaux sont consécutifs quand aucun autre créneau ne se place entre eux, quelle que soit la pause qui les sépare.
- **PR-9** Le nom d'une table est unique dans la convention, selon la même règle de comparaison que les pseudos (ID-7).
- **PR-10** On ne peut pas supprimer un créneau ou une table qui porte des parties. Supprimer un créneau supprime les disponibilités qui s'y rattachent.
- **PR-11** Les heures d'un créneau ne se modifient plus dès qu'une partie ou une disponibilité s'y rattache. Aucun créneau ne peut être ajouté ou déplacé entre les deux créneaux d'une partie double.
- **PR-12** Un Organisateur crée les MJ, chacun avec un pseudo unique parmi les MJ (ID-7) et modifiable à tout moment. On ne peut pas supprimer un MJ qui a au moins un scénario. Supprimer un MJ supprime ses disponibilités.
- **PR-13** Un Organisateur a, sur les scénarios et les disponibilités de chaque MJ, les mêmes droits que ce MJ.
- **PR-14** Le contenu d'un scénario reste modifiable à tout moment. Sa durée ne se modifie plus dès qu'une partie en est programmée, et on ne peut pas supprimer un scénario qui a des parties.
- **PR-15** Une disponibilité porte sur un créneau entier, pour le MJ, pas pour un scénario. On ne peut pas retirer une disponibilité sur laquelle le MJ mène une partie.
- **PR-16** Un scénario appartient à un seul MJ, fixé à sa création.
- **PR-17** Un Organisateur peut déprogrammer une partie, la déplacer sur un autre créneau ou une autre table, ou échanger deux parties (chacune prend la place de l'autre). Le déplacement et l'échange respectent les contraintes de PR-5, et chaque partie garde ses places (PR-4).

### 5.3 Fiche d'une partie (front office)

Titre, jeu, pseudo du MJ, présentation, image, table, créneau (mention « double » le cas échéant), avertissements de contenu, compteur « *N* inscrits · *M* places », badge « Très demandée » quand les inscrits dépassent les places maximum.

### 5.4 Inscriptions

- **IN-1** Les inscriptions ne sont possibles qu'après leur ouverture par un Organisateur, le jour de la convention.
- **IN-2** Un participant peut s'inscrire à plusieurs parties d'un même créneau et se désinscrire librement tant que le tirage de ce créneau n'est pas lancé.
- **IN-3** S'inscrire à une partie double revient à se déclarer disponible sur ses deux créneaux.
- **IN-4** Un MJ ne peut pas s'inscrire comme joueur sur un créneau où il mène une partie. Si une partie de son scénario est programmée sur un créneau où il était inscrit comme joueur, ses inscriptions sur ce créneau sont retirées et il est notifié (« Tu mènes *X* au créneau *N*, table *T* »).
- **IN-5** Lors d'une inscription sur une partie très demandée, l'application avertit le participant et l'incite à s'inscrire à d'autres parties du créneau.

### 5.5 Tirage

- **TI-1** Le tirage se fait par créneau, lancé manuellement par un Organisateur. Le lancement ferme les inscriptions du créneau.
- **TI-2** Participants concernés : les inscrits du créneau, hors MJ qui y mènent une partie.
- **TI-3** Partie double : elle est tirée avec son premier créneau. Ses joueurs ne participent pas au tirage du créneau suivant, et leurs inscriptions sur ce créneau suivant sont ignorées.
- **TI-4** Priorités, dans l'ordre :
  1. ne jamais dépasser le maximum d'une partie et ne placer un participant que sur une partie où il est inscrit ;
  2. placer le plus de participants possible ;
  3. parmi les répartitions équivalentes, maximiser le nombre de parties qui atteignent leur minimum ;
  4. départager le reste au hasard.
- **TI-5** Le résultat est provisoire. L'Organisateur voit, par partie, ses joueurs et si elle est sous son minimum, ainsi que la liste des non placés.
- **TI-6** Ajustements possibles avant publication :
  - déplacer n'importe quel participant, y compris vers une partie où il n'est pas inscrit ;
  - maintenir ou annuler une partie sous son minimum ;
  - relancer le tirage autant de fois que souhaité ;
  - programmer une partie depuis la réserve : cela **annule le tirage provisoire et rouvre les inscriptions du créneau**, les inscrits du créneau sont notifiés, puis l'Organisateur relance le tirage.
- **TI-7** La publication rend le tirage définitif. Aucune partie ne peut plus être programmée sur ce créneau, et le résultat n'est plus modifiable en V1.

### 5.6 Notifications

Notifications push web. Chaque notification ouvre l'application sur le détail.

| Événement | Destinataires | Contenu |
|---|---|---|
| Partie programmée sur un créneau avant publication | Inscrits du créneau | « Nouvelle partie disponible au créneau *N* » |
| Partie programmée sur un créneau où le MJ était inscrit | Ce MJ | « Tu mènes *X* au créneau *N*, table *T* » |
| Publication — participant affecté | Le participant | « Tirage du créneau *N* publié » → partie et table |
| Publication — non placé | Le participant | « Pas de place pour toi au créneau *N* » → parties où il reste des places, avec leur table |
| Publication — MJ | Le MJ | La table où il mène |

Pour les participants sans notifications :

- un bandeau permanent « Active les notifications pour connaître ta table » tant qu'elles sont désactivées ;
- à chaque ouverture, l'application affiche en premier la dernière affectation publiée ;
- les Organisateurs complètent par une annonce orale.

## 6. Exigences non fonctionnelles

- **Mobile d'abord** pour le front office ; le back office vise un écran d'ordinateur.
- **PWA avec push web** (service worker, clés VAPID). Sur iPhone, le push n'est possible qu'une fois l'application ajoutée à l'écran d'accueil (iOS 16.4+) : le parcours d'accueil doit l'expliquer pas à pas.
- **Réseau mobile uniquement** : pages légères, images compressées, programme et affectations mis en cache pour rester consultables sans réseau.
- **Charge** : jusqu'à ~80 personnes qui consultent et s'inscrivent en même temps, avec un pic à chaque publication.
- **Données personnelles** : aucun email ni donnée nominative côté participant ; seuls les emails des MJ et Organisateurs sont stockés.
- **Envoi d'emails** : nécessaire uniquement pour les liens magiques du back office.
- **Langue** : français.
- **Pile technique** : Angular (front office PWA et back office), NestJS, Prisma / PostgreSQL, Docker sur VPS derrière Caddy.

## 7. Hors V1

- Échelle de préférence sur les inscriptions (on s'inscrit ou non).
- Inscription en groupe d'amis.
- Équité entre créneaux ou brassage explicite dans l'algorithme.
- Départs en cours de journée, absences, modification d'un tirage publié.
- Suivi des places libres après publication.
- Écran public d'affichage des affectations.
- MJ désigné à la volée le jour J : toutes les parties viennent de scénarios enregistrés à l'avance.
- Espace Organisateur sur mobile, alertes push aux Organisateurs.
- Badges QR, passkeys ou autre identification plus robuste (pistes d'évolution, cf. ADR 0001).
- Reprise des données d'une convention à la suivante (comptes MJ, scénarios, tables) : chaque convention repart d'une base vide.

## 8. Points ouverts

- **Programme public avant la convention** : dans l'application ou sur le site de l'association ?
- **Pseudo du MJ** : une fois connecté au back office, le MJ peut-il modifier lui-même le pseudo qu'un Organisateur lui a donné (PR-12) ?
