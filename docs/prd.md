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
| **Participant** | Non | **Pseudo** seul, derrière le **code de présence** | Front office mobile (PWA) |
| **MJ** | Oui (email) | Back office : lien magique par email. Téléphone : **pseudo**, comme un participant | Back office (avant la convention) + front office mobile |
| **Organisateur** | Oui (email) | Lien magique par email | Back office, sur ordinateur portable, y compris le jour J |

Un MJ est aussi un participant : il peut jouer sur les créneaux où il ne mène pas. Une même personne peut être MJ et Organisateur ; elle n'a qu'un compte. Sur le téléphone, un Organisateur qui n'est pas MJ est un participant comme les autres.

Choix d'identification : voir [ADR 0009](adr/0009-identification-par-pseudo-sans-secret-derriere-un-code-de-presence.md), qui remplace l'ADR 0001.

## 3. Les deux applications

- **Front office participants** — mobile d'abord, installable (PWA) pour recevoir les notifications. Utilisé par les participants et par les MJ (pour jouer, et pour savoir à quelle table ils mènent). Aucune fonction d'Organisateur.
- **Back office** — orienté ordinateur. Utilisé par les MJ pour proposer leurs scénarios avant la convention, et par les Organisateurs pour tout le reste, **y compris le pilotage du jour J** (surcharge, tirage, ajustements, publication).

## 4. Parcours

### 4.1 Préparation (avant la convention)

1. Un Organisateur renseigne la convention (nom, date), ses **créneaux** (heure de début, heure de fin) et ses **tables** (nom).
2. Il crée les MJ, chacun avec son **pseudo** (PR-12), puis les comptes MJ et Organisateurs (email).
3. Le MJ se connecte au back office par lien magique, puis propose ses **scénarios** et ses **disponibilités** (les créneaux où il peut mener). Il peut modifier ses scénarios à tout moment ; il n'y a pas de validation par les Organisateurs. Un Organisateur peut aussi les saisir et les modifier à sa place (PR-13).
4. Les Organisateurs **programment** des scénarios sur un créneau et une table, dès avant la convention, ce qui crée des **parties**, ou les laissent en **réserve**. Le jour J, ils peuvent encore programmer une partie depuis la réserve (TI-6).
5. Un Organisateur fixe la **plage d'accès** du front office (début et fin, en date et heure) et le **code d'accès anticipé**.
6. Les Organisateurs affichent sur place le QR code qui porte le **code de présence** de la convention. Ce code est fixé à la création de la convention, ne change pas et se lit dans le back office.

Avant la plage d'accès, le front office est fermé : il affiche seulement « L'application sera accessible le *date* à *heure* », et le programme ne s'y lit pas. Le code d'accès anticipé permet d'entrer quand même, par exemple pour que les Organisateurs testent le parcours sur leur téléphone. Après la plage, l'application affiche « La convention est terminée » et plus rien n'y est consultable.

Tant qu'aucune plage d'accès n'est fixée, le front office reste fermé ; la seule contrainte est que le début précède la fin. Hors de la plage et sans le code d'accès anticipé, le serveur refuse aussi de créer un pseudo, de relier un téléphone et de servir le programme. Changer le code d'accès anticipé renvoie à l'écran d'attente les téléphones entrés avec l'ancien.

### 4.2 Arrivée sur place

1. Le participant scanne le QR code affiché sur place : il ouvre l'application, qui reçoit le **code de présence**.
2. Le premier écran est l'identification : on ne peut rien faire dans l'application sans elle. L'application demande un pseudo.
   - **Pseudo nouveau** : il est créé et relié au téléphone.
   - **Pseudo existant** : l'application demande « Ce pseudo existe déjà. Est-ce bien toi qui l'as créé ? ». Sur un « oui », le téléphone y est relié ; sinon, le participant en choisit un autre.
   - **Pseudo d'un MJ** : l'application demande au participant de confirmer qu'il est ce MJ. Sur un « oui », le téléphone est relié à ce MJ ; sinon, le participant choisit un autre pseudo.
3. L'application le guide pour l'ajouter à l'écran d'accueil (indispensable sur iPhone) et accepter les notifications.

Tant que les inscriptions ne sont pas ouvertes, l'application affiche « Les inscriptions ouvriront le jour de la convention » et permet de consulter le programme.

### 4.3 Inscriptions

1. Le matin, un Organisateur déclenche l'**ouverture des inscriptions** depuis le back office.
2. Le participant parcourt les parties par créneau et consulte leur fiche (§5.3).
3. Il s'**inscrit** à autant de parties qu'il veut, y compris plusieurs sur le même créneau, et peut se désinscrire librement tant que le tirage du créneau n'est pas lancé.
4. S'il s'inscrit à une **partie très demandée**, l'application le prévient qu'il risque de ne pas être pris et l'incite à s'inscrire aussi à d'autres parties du créneau.

### 4.4 Pilotage d'un créneau (Organisateur, back office)

1. **Surveiller la surcharge** : le back office affiche en permanence, pour chaque créneau, *demande / capacité*, avec un code couleur dès que la demande dépasse la capacité.
2. **Soulager un créneau** : l'Organisateur programme une partie depuis la réserve. Tous ceux qui peuvent s'inscrire sur ce créneau reçoivent une notification « Créneau *N* : nouvelle partie » (NO-2).
3. **Lancer le tirage** : les inscriptions du créneau se ferment ; le tirage produit un résultat **provisoire**.
4. **Examiner et ajuster** : l'Organisateur voit les parties, leurs joueurs, les parties sous leur minimum et les **non placés**, et peut faire des **ajustements** (§5.5).
5. **Publier** : le résultat devient définitif et les notifications partent (§5.6).

### 4.5 Après la publication

Le tirage publié est figé. Les non placés vont voir les MJ des tables où il reste de la place ; ces mouvements ne sont pas suivis par l'application.

## 5. Exigences fonctionnelles

### 5.1 Identité

- **ID-1** Un participant s'identifie par son seul pseudo, unique dans la convention (ID-7), sans compte, sans email et sans secret. Quand le pseudo saisi existe, l'application demande « Ce pseudo existe déjà. Est-ce bien toi qui l'as créé ? » et ne relie le téléphone qu'après un « oui ».
- **ID-2** Sans le code de présence de la convention, le serveur refuse toute identification. Le QR code affiché sur place transmet ce code ; l'application le garde, le renvoie à chaque identification, et ne le demande au participant que s'il lui manque. Il est imprimé en clair sous le QR code : 6 caractères, majuscules et chiffres, sans 0/O ni 1/I/L. Le code est fixé à la création de la convention, ne change pas et se lit dans le back office. Les essais sont limités à 20 échecs par adresse IP et par 10 minutes.
- **ID-3** Quand le pseudo saisi est celui d'un MJ, l'application demande au participant de confirmer qu'il est ce MJ, et ne relie le téléphone à ce MJ qu'après un « oui ». Aucun code n'est demandé. Le téléphone suit alors les mêmes règles que celui d'un participant (ID-8, ID-9, IN-4), et reçoit en plus les notifications propres au MJ (§5.6). Il ne donne accès à aucune fonction du back office.
- **ID-4** Le pseudo d'un MJ ne devient jamais celui d'un participant : le saisir relie le téléphone à ce MJ (ID-3). Un MJ ne peut pas recevoir un pseudo déjà pris par un participant (PR-12).
- **ID-5** Dans le back office, un Organisateur peut :
  - retrouver un pseudo par une partie de son nom (selon ID-7) ou par le titre d'une partie où il est inscrit, et le redire au participant ;
  - voir, pour chaque pseudo, de participant ou de MJ, ses inscriptions, son résultat dans chaque tirage lancé (une partie, ou non placé) et ses téléphones reliés, avec l'heure de chaque liaison, sans rien sur l'appareil ;
  - couper tous les liens d'un pseudo, de participant ou de MJ, en un seul geste : rien n'empêche ensuite de le relier de nouveau ;
  - supprimer un pseudo de participant (ID-10), par exemple un doublon ou un abus ;
  - fusionner un pseudo de participant dans un autre (ID-11).

  Les inscriptions d'un pseudo ne passent sur un autre que par une fusion : un MJ qui s'est d'abord inscrit sous un autre pseudo se réinscrit sous le sien, ou demande une fusion. Un Organisateur ne renomme pas un pseudo de participant et ne désinscrit personne avant le tirage. Ces gestes n'envoient aucune notification et ne sont pas journalisés.
- **ID-6** MJ et Organisateurs se connectent au back office par lien magique envoyé par email.
- **ID-7** Deux pseudos sont le même pseudo quand ils ne diffèrent que par la casse, les accents ou les espaces (au début, à la fin, ou plusieurs à la suite) : « Élodie » et « elodie » sont le même pseudo. La ponctuation compte : « Jean-Luc » et « Jean Luc » sont deux pseudos distincts. Un pseudo s'affiche tel qu'il a été saisi.
- **ID-8** Un téléphone est relié à un seul pseudo à la fois ; un pseudo peut être relié à plusieurs téléphones. Le relier à un nouveau téléphone ne coupe rien sur les autres ; un pseudo supprimé ou fusionné (ID-10, ID-11) perd tous ses liens, et un Organisateur peut les couper (ID-5). Un téléphone dont le lien est coupé revient à l'identification à son prochain échange avec le serveur, et oublie sa copie hors ligne. Les notifications vont aux téléphones reliés au pseudo au moment de l'envoi. Le participant ne voit pas les autres téléphones reliés à son pseudo.
- **ID-9** « Changer de pseudo » coupe le lien du téléphone et ramène à l'identification : pour corriger une erreur, ou pour inscrire plusieurs personnes depuis un même téléphone. L'ancien pseudo reste, avec ses inscriptions. Un participant ne peut pas modifier son pseudo.
- **ID-10** Supprimer un pseudo de participant est toujours possible, même après la publication d'un tirage. Le pseudo perd ses liens, ses inscriptions et son résultat dans les tirages, provisoires ou publiés, puis redevient libre. Après la publication, sa partie compte simplement un joueur de moins : la place n'est proposée à personne (§7). Un MJ ne se supprime que par PR-12.
- **ID-11** Fusionner un pseudo de participant (la source) dans un autre pseudo, de participant ou de MJ (la destination), fait passer sur la destination les inscriptions de la source et son résultat dans les tirages, provisoires ou publiés, puis supprime la source (ID-10) : ses liens sont coupés, pas transférés. La destination garde une seule inscription par partie, et une seule table par créneau ; une partie double compte sur ses deux créneaux :
  - sur un créneau où la destination mène une partie (IN-4) ou est déjà placée par un tirage, les inscriptions et le résultat de la source sont perdus ;
  - sur un créneau où la source est placée et la destination non placée, la destination prend la partie de la source ;
  - ailleurs, les inscriptions et le résultat de la source passent à la destination.

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
- **PR-12** Un Organisateur crée les MJ, chacun avec un pseudo unique dans la convention, parmi les MJ comme parmi les participants (ID-4, ID-7), et modifiable à tout moment. On ne peut pas supprimer un MJ qui a au moins un scénario. Supprimer un MJ supprime ses disponibilités, coupe ses liens, et efface ses inscriptions et son résultat dans les tirages, comme pour un pseudo de participant (ID-10). Renommer un MJ ne coupe pas ses liens.
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
- **IN-4** Un MJ ne peut pas s'inscrire comme joueur sur un créneau où il mène une partie. Si une partie de son scénario est programmée sur un créneau où il était inscrit comme joueur, ses inscriptions sur ce créneau sont retirées et il est notifié (NO-2).
- **IN-5** Lors d'une inscription sur une partie très demandée, l'application avertit le participant et l'incite à s'inscrire à d'autres parties du créneau.
- **IN-6** Tant que le tirage de son créneau n'est pas lancé, une partie déprogrammée perd ses inscriptions, comme une partie déplacée sur un autre créneau, par un déplacement ou un échange. Ses inscrits sont notifiés (NO-2) et se réinscrivent s'ils le veulent. Changer la table d'une partie, ou l'échanger avec une partie du même créneau, garde ses inscriptions.

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
  - programmer une partie depuis la réserve : cela **annule le tirage provisoire et rouvre les inscriptions du créneau**, tous ceux qui peuvent s'y inscrire sont notifiés (NO-2), puis l'Organisateur relance le tirage.
- **TI-7** La publication rend le tirage définitif. Aucune partie ne peut plus être programmée sur ce créneau, et le résultat n'est plus modifiable en V1, sauf par la suppression ou la fusion d'un pseudo (ID-10, ID-11).

### 5.6 Notifications

Notifications push web. Chaque notification se suffit à elle-même : son titre commence par le créneau, car il tient sur une ligne et se coupe selon l'écran ; son corps donne la partie et la table. Un tap ouvre l'application sur le détail.

- **NO-1** Une notification part vers les téléphones reliés au destinataire au moment de l'envoi (ID-8). Rien ne part avant l'ouverture des inscriptions. Un même geste envoie au plus une notification à une même personne, la plus précise : les inscrits d'une partie déplacée reçoivent « partie déplacée », pas « nouvelle partie ».
- **NO-2** Événements notifiés :

  | Événement | Destinataires | Titre | Corps | Le tap ouvre |
  |---|---|---|---|---|
  | Partie programmée sur un créneau, avant sa publication (y compris par un déplacement) | Tous, sauf ceux qui ne peuvent pas s'inscrire sur ce créneau : les MJ qui y mènent, les joueurs d'une partie double publiée qui l'occupe | Créneau *N* : nouvelle partie | *Titre* · *Jeu*, table *T*. Tu peux t'y inscrire. | La fiche de la partie |
  | Partie programmée, ou déplacée sur un autre créneau | Son MJ | Créneau *N* : tu mènes une partie | *Titre*, table *T*, *début* – *fin*. | La vue du MJ |
  | Partie déprogrammée, avant le tirage de son créneau | Ses inscrits | Créneau *N* : partie retirée du programme | *Titre* est retirée : ton inscription est supprimée. | Les parties du créneau |
  | Partie déprogrammée, avant le tirage de son créneau | Son MJ | Créneau *N* : partie retirée du programme | *Titre* est retirée : tu peux t'inscrire sur ce créneau. | Les parties du créneau |
  | Partie déplacée sur un autre créneau, avant le tirage (IN-6) | Ses inscrits | Créneau *N* : partie déplacée | *Titre* passe au créneau *M* : ton inscription est retirée. Réinscris-toi si l'horaire te va. | La fiche de la partie |
  | Publication — affecté | Le participant | Créneau *N* : table *T* | Tu joues à *Titre*, avec *pseudo du MJ*. | La fiche de la partie |
  | Publication — non placé | Le participant | Créneau *N* : pas de place pour toi | Les parties que tu avais choisies sont complètes. Il reste de la place aux tables *T1* et *T3* : va voir leur MJ. | Les parties du créneau où il reste de la place |
  | Publication — MJ | Le MJ | Créneau *N* : tu mènes à la table *T* | *Titre*, avec *K* joueurs. | La vue du MJ |
  | Publication — partie annulée (TI-6) | Son MJ | Créneau *N* : ta partie est annulée | *Titre* n'a pas atteint son minimum. Il reste de la place aux tables *T1* et *T3* : va voir leur MJ. | Les parties du créneau où il reste de la place |

  Variantes :
  - après l'annulation d'un tirage provisoire (TI-6), le corps de « nouvelle partie » se termine par « Les inscriptions du créneau sont rouvertes. » ;
  - quand le MJ était inscrit sur ce créneau (IN-4), le corps de « tu mènes une partie » se termine par « Tes inscriptions sur ce créneau sont retirées. » ;
  - quand aucune table n'a de place, « Toutes les parties du créneau sont complètes. » remplace le corps du non placé, et la phrase « Il reste de la place… » de la partie annulée ;
  - une partie double se désigne par ses deux créneaux : « Créneaux 2 et 3 : table *T* ».
- **NO-3** Une notification que le téléphone n'a pas encore reçue n'est plus livrée après la fin du créneau qu'elle concerne (le second, pour une partie double).
- **NO-4** Ne sont pas notifiés : l'ouverture des inscriptions, le lancement d'un tirage, le changement de table d'une partie et l'échange de deux parties d'un même créneau, les gestes de ID-5. Pas de rappel avant un créneau (§7).
- **NO-5** Le téléphone affiche la notification même quand l'application est ouverte. Sur iPhone, les notifications successives s'empilent : elles ne se remplacent pas.
- **NO-6** Sur un téléphone qui ne reçoit pas les notifications, chaque écran porte un bandeau qu'on ne peut pas fermer. Sauf dans le dernier cas, un tap ouvre le guide d'activation (§4.2) :

  | Cas | Bandeau |
  |---|---|
  | iPhone, application pas ajoutée à l'écran d'accueil | « Ajoute l'application à l'écran d'accueil pour connaître ta table » |
  | Permission pas encore donnée | « Active les notifications pour connaître ta table » |
  | Permission refusée | « Notifications bloquées : réactive-les dans les réglages pour connaître ta table » |
  | Push non pris en charge | « Ce téléphone ne reçoit pas les notifications : reviens voir ta table ici après chaque tirage » |

  À chaque ouverture, l'application affiche en premier la dernière affectation publiée. Les Organisateurs annoncent aussi chaque publication à voix haute.

## 6. Exigences non fonctionnelles

- **Mobile d'abord** pour le front office ; le back office vise un écran d'ordinateur.
- **PWA avec push web** (service worker, clés VAPID). Sur iPhone, le push n'est possible qu'une fois l'application ajoutée à l'écran d'accueil (iOS 16.4+) : le parcours d'accueil doit l'expliquer pas à pas.
- **Réseau mobile uniquement** : pages légères, images compressées, programme et affectations mis en cache pour rester consultables sans réseau.
- **Charge** : jusqu'à ~80 personnes qui consultent et s'inscrivent en même temps, avec un pic à chaque publication.
- **Session** : un cookie posé par le serveur, illisible par les scripts de la page, relie le téléphone à son pseudo. Il n'a pas d'expiration propre : la plage d'accès fait foi. L'application garde à côté une copie non secrète pour l'affichage hors ligne.
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
- Espace Organisateur sur mobile, notifications aux Organisateurs.
- Rappel avant le début d'un créneau.
- Badges QR, passkeys, code MJ ou autre identification plus robuste (pistes d'évolution, cf. ADR 0009).
- Verrou d'un pseudo après une usurpation, journal des gestes des Organisateurs.
- Site public du programme avant la convention : une troisième interface, distincte du front office et du back office.
- Reprise des données d'une convention à la suivante (comptes MJ, scénarios, tables) : chaque convention repart d'une base vide.

## 8. Points ouverts

- **Pseudo du MJ** : une fois connecté au back office, le MJ peut-il modifier lui-même le pseudo qu'un Organisateur lui a donné (PR-12) ?
