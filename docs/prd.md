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

- **Front office participants** — mobile d'abord, installable (PWA) pour recevoir les notifications. Utilisé par les participants et par les MJ (pour jouer, et pour retrouver les parties qu'ils mènent et leurs joueurs, §5.7). Aucune fonction d'Organisateur. Un créneau terminé n'y apparaît plus.
- **Back office** — orienté ordinateur. Utilisé par les MJ pour proposer leurs scénarios avant la convention, et par les Organisateurs pour tout le reste, **y compris le pilotage du jour J** (surcharge, tirage, ajustements, publication).

## 4. Parcours

### 4.1 Préparation (avant la convention)

1. Un Organisateur renseigne la convention (nom, date), ses **créneaux** (heure de début, heure de fin) et ses **tables** (nom).
2. Il crée les MJ, chacun avec son **pseudo** (PR-12), puis les comptes MJ et Organisateurs (email).
3. Le MJ se connecte au back office par lien magique, puis propose ses **scénarios** et ses **disponibilités** (les créneaux où il peut mener). Il peut modifier ses scénarios à tout moment ; il n'y a pas de validation par les Organisateurs. Un Organisateur peut aussi les saisir et les modifier à sa place (PR-13).
4. Les Organisateurs **programment** des scénarios sur un créneau et une table, dès avant la convention, ce qui crée des **parties**, ou les laissent en **réserve**. Le jour J, ils peuvent encore programmer une partie depuis la réserve (TI-6).
5. Les Organisateurs affichent sur place le QR code qui porte le **code de présence** de la convention. Ce code est fixé à la création de la convention, ne change pas et se lit dans le back office.

Sans le code de présence, le front office est fermé : il ne fait que demander ce code, et le programme ne s'y lit pas. Avec lui, tout fonctionne, inscriptions comprises, à toute heure : le jour J pour ceux qui scannent l'affiche, avant pour ceux à qui un Organisateur le donne, par exemple pour tester le parcours sur leur téléphone. Les pseudos de test se suppriment ensuite (ID-10). Si le code fuit avant la convention, on l'accepte (ID-2).

La convention se termine à la fin de son dernier créneau. L'application affiche alors « La convention est terminée », à tous, et plus rien n'y est consultable. Tant que la date ou les créneaux manquent, elle ne ferme pas. Le serveur refuse de créer un pseudo ou de relier un téléphone sans le code de présence, et de servir le programme à un téléphone relié à aucun pseudo. Après la fin de la convention, il refuse tout.

### 4.2 Arrivée sur place

1. Le participant scanne le QR code affiché sur place : il ouvre l'application, qui reçoit le **code de présence**. Quand le code lui manque, l'application le demande (ID-2) et dit où le trouver : sur l'affiche, en clair sous le QR code.
2. **Sur iPhone**, Safari ne sert qu'à installer l'application. Le premier écran dit à quoi servent les notifications, guide pas à pas l'ajout à l'écran d'accueil et montre le code de présence à retenir. L'application installée ne reçoit pas le code : elle le demande, puis passe à l'identification. On peut continuer dans Safari, sans notifications, après une confirmation.
3. Vient ensuite l'identification : on ne peut rien faire dans l'application sans elle. L'application demande un pseudo.
   - **Pseudo nouveau** : il est créé et relié au téléphone.
   - **Pseudo existant** : l'application demande « Ce pseudo existe déjà. Est-ce bien toi qui l'as créé ? ». Elle précise que c'est le cas si on l'a déjà tapé plus tôt : dans Safari avant d'installer l'application, sur un autre téléphone, ou avant la convention. En cas de doute, elle renvoie à un Organisateur. Sur un « oui », le téléphone y est relié ; sinon, le participant en choisit un autre.
   - **Pseudo d'un MJ** : l'application demande au participant de confirmer qu'il est ce MJ, et renvoie à un Organisateur en cas de doute. Sur un « oui », le téléphone est relié à ce MJ ; sinon, le participant choisit un autre pseudo.
4. L'application demande d'activer les notifications. Elle dit ce qu'elles apportent : sa table à la publication de chaque tirage, les nouvelles parties, ses parties déplacées ou retirées du programme et, pour un MJ, les parties qu'il mène. La demande du téléphone ne vient qu'après un tap. Passer outre demande une confirmation ; après un refus, l'application montre le chemin des réglages propre au téléphone.
5. **Sur Android**, l'application propose ensuite de s'installer. Une fois installée, elle invite à quitter Chrome pour l'ouvrir.

Tant que le téléphone ne reçoit pas les notifications, chaque écran porte le bandeau de NO-6. Un tap ouvre le **guide d'activation**, propre au cas et au système. Un téléphone qui ne peut pas les recevoir (iPhone sous iOS 16.3 ou moins) passe directement de l'identification à l'Accueil.

Les inscriptions sont déjà ouvertes : il n'y a pas d'état où l'on lit le programme sans pouvoir s'inscrire.

### 4.3 Inscriptions

1. Les inscriptions sont ouvertes dès qu'on entre dans l'application (§4.1), sans geste d'un Organisateur.
2. Le participant parcourt les parties par créneau et consulte leur fiche (§5.3).
3. Il s'**inscrit** à autant de parties qu'il veut, y compris plusieurs sur le même créneau, et peut se désinscrire librement tant que le tirage du créneau n'est pas lancé.
4. Avant qu'il s'inscrive à une **partie très demandée**, l'application lui demande une confirmation et l'incite à s'inscrire aussi à d'autres parties du créneau (IN-5). Quand une partie devient très demandée, ceux dont c'est la seule inscription sur le créneau sont notifiés (NO-2).

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
- **ID-2** Sans le code de présence de la convention, le serveur refuse toute identification. Le QR code affiché sur place transmet ce code ; l'application le garde, le renvoie à chaque identification, et ne le demande au participant que s'il lui manque. Il est imprimé en clair sous le QR code : 4 caractères, majuscules et chiffres, sans 0/O ni 1/I/L. Le code est fixé à la création de la convention, ne change pas et se lit dans le back office. Les essais sont limités à 20 échecs par adresse IP et par 10 minutes.
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
- **ID-9** « Changer de pseudo », après une confirmation, coupe le lien du téléphone et ramène à l'identification : pour corriger une erreur, ou pour inscrire plusieurs personnes depuis un même téléphone. L'ancien pseudo reste, avec ses inscriptions. Un participant ne peut pas modifier son pseudo.
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
- **PR-4** Une partie a les places de son scénario, et les suit quand il change. Pour changer les places d'une partie, on change celles de son scénario (PR-13).
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
- **PR-17** Un Organisateur peut déprogrammer une partie, la déplacer sur un autre créneau ou une autre table, ou échanger deux parties (chacune prend la place de l'autre). Le déplacement et l'échange respectent les contraintes de PR-5.

### 5.3 Fiche d'une partie (front office)

Dans l'ordre : image, titre, jeu et pseudo du MJ, créneau (« Créneaux 3 et 4 » pour une partie double) et table, compteur « *N* inscrits · *M* places » (*M* : les places maximum ; « *N* joueurs · *M* places » après la publication), badge « Très demandée » quand les inscrits dépassent les places maximum, avertissements de contenu, présentation. Les avertissements de contenu se lisent donc avant la présentation.

Une barre fixée en bas de l'écran porte le geste : « S'inscrire » ou, une fois inscrit, « Inscription enregistrée » et « Se désinscrire ». Pendant l'envoi, le bouton montre qu'il attend ; sans réseau, voir §6. Quand on ne peut pas s'inscrire, la barre dit pourquoi, à la place du bouton :

- sur la fiche de sa propre partie : « Tu mènes cette partie », et « Voir dans Mes parties » (§5.7) ;
- MJ qui mène une partie sur ce créneau, ou sur le second créneau d'une partie double (IN-4) : « Tu mènes une partie sur ce créneau », avec le titre et la table de sa partie ;
- joueur d'une partie double publiée qui occupe ce créneau : « Tu joues aux créneaux 3 et 4 », avec « Voir ta partie » ;
- tirage lancé : « Tirage en cours », les inscriptions du créneau sont fermées ; pour un inscrit, « Ton inscription compte pour ce tirage » ;
- tirage publié : « Tu joues à cette table », ou sa table sur ce créneau avec « Voir ta partie », ou « Pas de place pour toi », ou « Les inscriptions du créneau sont fermées ».

### 5.4 Inscriptions

- **IN-1** Les inscriptions sont ouvertes dès qu'on entre dans l'application avec le code de présence (§4.1), sans heure d'ouverture.
- **IN-2** Un participant peut s'inscrire à plusieurs parties d'un même créneau et se désinscrire librement tant que le tirage de ce créneau n'est pas lancé. S'inscrire à une partie où l'on est déjà inscrit, ou se désinscrire d'une partie où l'on ne l'est pas, ne change rien : un geste répété après une coupure du réseau est sans risque. Se désinscrire se fait d'un tap, sans confirmation.
- **IN-3** S'inscrire à une partie double revient à se déclarer disponible sur ses deux créneaux. Au programme, elle apparaît sous ses deux créneaux. S'y inscrire garde les inscriptions déjà prises sur son second créneau : elles comptent si l'on n'est pas placé dans la partie double, et le tirage les ignore sinon (TI-3). La fiche n'en dit rien.
- **IN-4** Un MJ ne peut pas s'inscrire comme joueur sur un créneau où il mène une partie. Si une partie de son scénario est programmée sur un créneau où il était inscrit comme joueur, ses inscriptions sur ce créneau sont retirées et il est notifié (NO-2).
- **IN-5** Avant une inscription qui ferait dépasser les places maximum d'une partie, y compris celle qui la fait passer en très demandée, l'application demande une confirmation :
  - titre : « Partie très demandée » ;
  - texte : « *Titre* a déjà *K* inscrits pour *M* places : tu risques de ne pas avoir de place. Inscris-toi aussi à d'autres parties du créneau *N*, pour avoir plus de chances de jouer. » ;
  - boutons : « S'inscrire quand même », « Voir les autres parties » (le programme du créneau, sans inscrire) et « Annuler ».

  Chaque fois qu'une partie devient très demandée, ceux de ses inscrits qui n'ont aucune autre inscription sur le créneau sont notifiés (NO-2). Tant que la seule inscription d'un participant sur un créneau est une partie très demandée, Mes parties et la ligne du créneau dans l'Accueil (« Ton programme ») affichent « Ta seule inscription du créneau *N* est une partie très demandée : inscris-toi aussi à une autre partie. » Une inscription à une partie double ne compte que sur son premier créneau.
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

- **NO-1** Une notification part vers les téléphones reliés au destinataire au moment de l'envoi (ID-8), y compris avant le jour J. Un même geste envoie au plus une notification à une même personne, la plus précise : les inscrits d'une partie déplacée reçoivent « partie déplacée », pas « nouvelle partie ».
- **NO-2** Événements notifiés :

  | Événement | Destinataires | Titre | Corps | Le tap ouvre |
  |---|---|---|---|---|
  | Partie programmée sur un créneau, avant sa publication (y compris par un déplacement) | Tous, sauf ceux qui ne peuvent pas s'inscrire sur ce créneau : les MJ qui y mènent, les joueurs d'une partie double publiée qui l'occupe | Créneau *N* : nouvelle partie | *Titre* · *Jeu*, table *T*. Tu peux t'y inscrire. | La fiche de la partie |
  | Partie programmée, ou déplacée sur un autre créneau | Son MJ | Créneau *N* : tu mènes une partie | *Titre*, table *T*, *début* – *fin*. | Mes parties, sur ce créneau (§5.7) |
  | Partie déprogrammée, avant le tirage de son créneau | Ses inscrits | Créneau *N* : partie retirée du programme | *Titre* est retirée : ton inscription est supprimée. | Les parties du créneau |
  | Partie déprogrammée, avant le tirage de son créneau | Son MJ | Créneau *N* : partie retirée du programme | *Titre* est retirée : tu peux t'inscrire sur ce créneau. | Les parties du créneau |
  | Partie déplacée sur un autre créneau, avant le tirage (IN-6) | Ses inscrits | Créneau *N* : partie déplacée | *Titre* passe au créneau *M* : ton inscription est retirée. Réinscris-toi si l'horaire te va. | La fiche de la partie |
  | Partie devenue très demandée, par une inscription ou une baisse de ses places maximum (PR-4), avant le tirage de son créneau (IN-5) | Ses inscrits qui n'ont aucune autre inscription sur le créneau, sauf celui dont l'inscription l'a fait passer en très demandée | Créneau *N* : partie très demandée | *Titre* est une partie très demandée, et c'est ta seule inscription sur ce créneau. Inscris-toi à d'autres parties pour éviter de te retrouver sans table où jouer. | Les parties du créneau |
  | Publication — affecté | Le participant | Créneau *N* : table *T* | Tu joues à *Titre*, avec *pseudo du MJ*. | La fiche de la partie |
  | Publication — non placé | Le participant | Créneau *N* : pas de place pour toi | Les parties que tu avais choisies sont complètes. Il reste de la place aux tables *T1* et *T3* : va voir leur MJ. | Les parties du créneau où il reste de la place |
  | Publication — MJ | Le MJ | Créneau *N* : tu mènes à la table *T* | *Titre*, avec *K* joueurs. | Mes parties, sur ce créneau (§5.7) |
  | Publication — partie annulée (TI-6) | Son MJ | Créneau *N* : ta partie est annulée | *Titre* n'a pas atteint son minimum. Il reste de la place aux tables *T1* et *T3* : va voir leur MJ. | Les parties du créneau où il reste de la place |

  Variantes :
  - après l'annulation d'un tirage provisoire (TI-6), le corps de « nouvelle partie » se termine par « Les inscriptions du créneau sont rouvertes. » ;
  - quand le MJ était inscrit sur ce créneau (IN-4), le corps de « tu mènes une partie » se termine par « Tes inscriptions sur ce créneau sont retirées. » ;
  - quand aucune table n'a de place, « Toutes les parties du créneau sont complètes. » remplace le corps du non placé, et la phrase « Il reste de la place… » de la partie annulée ;
  - une partie double se désigne par ses deux créneaux : « Créneaux 2 et 3 : table *T* ».

  « Partie très demandée » part chaque fois que la partie dépasse ses places maximum, même si elle les a déjà dépassées plus tôt. Une inscription à une partie double ne compte que sur son premier créneau (TI-3).
- **NO-3** Une notification que le téléphone n'a pas encore reçue n'est plus livrée après la fin du créneau qu'elle concerne (le second, pour une partie double).
- **NO-4** Ne sont pas notifiés : le lancement d'un tirage, le changement de table d'une partie et l'échange de deux parties d'un même créneau, les gestes de ID-5, une partie qui redescend sous ses places maximum. Pas de rappel avant un créneau (§7).
- **NO-5** Quand l'application est ouverte, le téléphone range la notification sans l'afficher en grand : sur Android, elle va dans le volet, avec son, sans fenêtre en haut de l'écran, et l'iPhone n'affiche probablement pas de bannière. L'application montre donc elle-même, par une alerte, ce qui change pour le participant sans geste de sa part : tirage publié qui le concerne, inscription retirée, et pour un MJ, partie à mener ajoutée ou retirée. Elle le voit en relisant ses données (§6, Fraîcheur), pas par le push : cela marche aussi sans notifications. Pas d'alerte pour « nouvelle partie », que le programme montre déjà, ni pour « partie très demandée », que montrent Mes parties et l'Accueil (IN-5). L'alerte porte « Voir », qui ouvre l'Accueil pour un tirage publié, les parties du créneau pour une inscription retirée, Mes parties sur ce créneau pour une partie à mener (§5.7). Elle reste jusqu'à ce qu'on la ferme ou qu'on touche « Voir ». Les notifications « nouvelle partie » d'un même créneau se remplacent, sans nouveau son : un téléphone resté hors ligne ne reçoit que la dernière. Sur iPhone, celles déjà affichées restent empilées. Les « partie très demandée » d'un même créneau se remplacent de la même façon, mais avec un son. Les autres notifications s'empilent.
- **NO-6** Sur un téléphone qui ne reçoit pas les notifications, chaque écran porte un bandeau qu'on ne peut pas fermer. Sauf dans le dernier cas, un tap ouvre le guide d'activation (§4.2) :

  | Cas | Bandeau |
  |---|---|
  | iPhone, application pas ajoutée à l'écran d'accueil | « Ajoute l'application à l'écran d'accueil pour connaître ta table » |
  | Permission pas encore donnée | « Active les notifications pour connaître ta table » |
  | Permission refusée | « Notifications bloquées : réactive-les dans les réglages pour connaître ta table » |
  | Push non pris en charge | « Ce téléphone ne reçoit pas les notifications : reviens voir ta table ici après chaque tirage » |

  À chaque ouverture, l'application affiche en premier la dernière affectation publiée, tant que son créneau n'est pas terminé. Les Organisateurs annoncent aussi chaque publication à voix haute.

### 5.7 Parties à mener (front office)

Un téléphone relié à un MJ n'a pas d'écran à part. L'onglet Mes parties suit sa journée créneau par créneau, dans ses deux rôles : sur un créneau où il mène, sa partie s'y déplie en entier.

- Table, titre, jeu, et l'heure de début, ou « Maintenant » pendant le créneau.
- Avant le tirage : le nombre d'inscrits (« 7 inscrits · 4 à 5 places »), avec « Très demandée » au-delà du maximum, mais pas leurs pseudos.
- Tirage lancé : « Tirage en cours ». Le résultat provisoire reste invisible.
- À la publication : les pseudos de ses joueurs, dans l'ordre alphabétique.
- Partie annulée (TI-6) : « Partie annulée », et les tables où il reste de la place.

Les notifications propres au MJ (NO-2), l'alerte d'une partie à mener (NO-5) et « Voir tes joueurs » sur l'Accueil ouvrent Mes parties sur ce créneau. La fiche de sa partie (§5.3) est celle que lisent les joueurs, avec « Tu mènes cette partie » et un lien vers Mes parties. Pendant le tirage de son créneau, l'Accueil montre « Tirage en cours » avec la partie qu'il mène. Le programme signale les créneaux où il mène, et dit pourquoi il ne peut pas s'y inscrire (IN-4).

## 6. Exigences non fonctionnelles

- **Mobile d'abord** pour le front office ; le back office vise un écran d'ordinateur.
- **PWA avec push web** (service worker, clés VAPID). Sur iPhone, le push n'est possible qu'une fois l'application ajoutée à l'écran d'accueil (iOS 16.4+) : le parcours d'accueil doit l'expliquer pas à pas.
- **Réseau mobile uniquement** : pages légères, images compressées. Le programme, avec le contenu de toutes ses fiches, et la situation du participant (inscriptions, affectations, parties qu'il mène et leurs joueurs) restent consultables sans réseau, jusqu'à 30 jours après leur dernière lecture. Les images déjà vues aussi ; les autres prennent l'illustration par défaut (PR-7). Hors ligne aussi, un créneau terminé disparaît, et l'application affiche « La convention est terminée » à la fin du dernier créneau, selon l'heure du téléphone. Sans réseau ni copie (premier lancement), l'application dit qu'il lui faut du réseau.
- **Fraîcheur** : l'application relit ses données à son ouverture et à celle de chaque écran, au retour au premier plan, après chaque geste, à la réception d'une notification quand le téléphone la lui transmet, et toutes les 30 s tant qu'elle est visible. Une lecture qui échoue garde la dernière donnée à l'écran. Si la donnée a plus de 2 minutes, une ligne sous l'en-tête l'indique : « Pas de connexion · à jour à 14 h 05 », ou « Pas de connexion · à jour le 26 octobre à 18 h 05 » un autre jour ; un tap sur la ligne relance la lecture. Pas de bouton « Actualiser ».
- **Écritures sans réseau** : refusées, sans file d'attente. Le bouton reste actif ; en cas d'échec, une alerte dit « Pas de connexion : rien n'a été enregistré. » Après 10 s sans réponse : « Le réseau ne répond pas : vérifie ton inscription. », puis l'application relit (IN-2). Un geste refusé parce que la donnée affichée était périmée (tirage lancé entre-temps) donne le message de l'API, puis l'application relit.
- **Mise à jour de l'application** : elle est cherchée au lancement, au retour au premier plan et toutes les 5 minutes. Une version prête s'installe sans rien demander, à la navigation suivante (onglet, fiche), ou à défaut au retour au premier plan suivant.
- **Charge** : jusqu'à ~80 personnes qui consultent et s'inscrivent en même temps, avec un pic à chaque publication.
- **Session** : un cookie posé par le serveur, illisible par les scripts de la page, relie le téléphone à son pseudo. Il n'a pas d'expiration propre : la fin de la convention fait foi (§4.1). L'application garde à côté une copie non secrète pour l'affichage hors ligne. Après « Changer de pseudo », la copie hors ligne de l'ancien pseudo ne s'affiche plus.
- **Données personnelles** : aucun email ni donnée nominative côté participant ; seuls les emails des MJ et Organisateurs sont stockés.
- **Envoi d'emails** : nécessaire uniquement pour les liens magiques du back office.
- **Langue** : français.
- **Heure** : la date et les heures de la convention s'entendent à l'heure de Paris.
- **Pile technique** : Angular (front office PWA et back office), NestJS, Prisma / PostgreSQL, Docker sur VPS derrière Caddy.

## 7. Hors V1

- Échelle de préférence sur les inscriptions (on s'inscrit ou non).
- Inscription en groupe d'amis.
- Équité entre créneaux ou brassage explicite dans l'algorithme.
- Départs en cours de journée, absences, modification d'un tirage publié.
- Suivi des places libres après publication.
- Places propres à une partie, distinctes de celles de son scénario (PR-4).
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
