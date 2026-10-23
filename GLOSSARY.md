# Histoires de Chimères

Organisation d'une convention de jeu de rôle : les participants s'inscrivent sur les parties proposées, puis un tirage au sort les répartit sur les tables, créneau par créneau.

Chaque terme est suivi du terme anglais qui le désigne dans le code (ADR 0003). Les échanges se font avec le terme français.

## Programme

**Convention** · `Convention`:
L'événement dans son ensemble, sur une journée, découpé en créneaux.

**Créneau** · `TimeSlot`:
Plage horaire de la journée, habituellement de 2h30, pendant laquelle se jouent les parties en parallèle. Les créneaux ne se chevauchent pas ; deux créneaux sont consécutifs quand aucun autre ne se place entre eux, même s'ils sont séparés par une pause (repas, etc.).
_Avoid_: Session, tour, slot (seul)

**Scénario** · `Scenario`:
Ce qu'un MJ propose de faire jouer : un contenu (titre, jeu, présentation, image, avertissements de contenu), un nombre de places minimum et maximum, MJ non compris, et une durée d'un ou deux créneaux. Un scénario appartient à un seul MJ.
_Avoid_: Module, aventure, proposition

**Places** · `Seats`:
Nombre de joueurs qu'une partie accueille, MJ non compris, entre un minimum et un maximum.

**Avertissements de contenu** · `ContentWarnings`:
Thèmes sensibles qu'un scénario aborde, signalés aux participants avant qu'ils s'inscrivent.
_Avoid_: Trigger warning

**Jeu** · `System`:
Le jeu de rôle publié (règles et univers) sur lequel repose un scénario, par exemple L'Appel de Cthulhu.
_Avoid_: Game (réservé à la partie)

**Disponibilité** · `Availability`:
Créneau sur lequel un MJ déclare pouvoir mener.

**Partie** · `Game`:
Un scénario programmé par un Organisateur sur un créneau (deux créneaux consécutifs pour un scénario double), à une table. Un même scénario peut donner plusieurs parties. Une partie a les places de son scénario, sauf si l'Organisateur lui en fixe d'autres.
_Avoid_: Session, jeu, table

**Programmer** · `schedule`:
Action d'un Organisateur qui fait d'un scénario une partie, en lui attribuant un créneau et une table.
_Avoid_: Ouvrir (réservé à l'ouverture des inscriptions), planifier

**Déprogrammer** · `unschedule`:
Action d'un Organisateur qui retire une partie du programme ; son scénario reste proposé.
_Avoid_: Annuler (réservé à la partie sous son minimum, après le tirage)

**Déplacer une partie** · `moveGame`:
Action d'un Organisateur qui change le créneau ou la table d'une partie ; elle reste la même partie, avec ses places. Une partie double se déplace par son premier créneau, et prend le créneau consécutif avec elle.

**Échanger deux parties** · `swapGames`:
Action d'un Organisateur qui met chacune de deux parties à la place de l'autre, en un seul geste ; chacune reste la même partie, avec ses places.
_Avoid_: Permuter, intervertir

**Programme** · `Schedule`:
L'ensemble des parties programmées de la convention.

**Partie double** · `TwoSlotGame`:
Partie qui occupe deux créneaux consécutifs ; ses joueurs sont les mêmes sur les deux créneaux.
_Avoid_: DoubleGame

**Réserve** · `Reserve`:
Les scénarios qui pourraient être programmés sur un créneau : leur MJ y est disponible et n'y mène aucune partie (sur ce créneau et le suivant pour un scénario double). Un scénario déjà programmé sur un autre créneau en fait partie. L'Organisateur y puise pour soulager un créneau surchargé.

**Verdict de placement** · `Placement`:
Pour une case du programme (un créneau et une table), ce que donnerait le geste de programmer un scénario ou de déplacer une partie : permis, ou refusé avec son motif. Il obéit à la même règle que le geste lui-même.

**Table** · `Table`:
L'emplacement physique où se joue une partie.
_Avoid_: Salle (sauf si c'est réellement une salle)

## Personnes

**Participant** · `Participant`:
Personne présente à la convention et susceptible de jouer.
_Avoid_: Utilisateur, inscrit, User

**Pseudo** · `Nickname`:
Nom sous lequel un participant apparaît dans la convention. Celui d'un MJ est défini avant la convention.
_Avoid_: Login, nom d'utilisateur, compte, Username

**Code de récupération** · `RecoveryCode`:
Code personnel remis au participant à la création de son pseudo, qui lui permet de retrouver son identité sur un autre appareil.
_Avoid_: Mot de passe, code d'accès, Password

**Code MJ** · `GameMasterCode`:
Code personnel remis à l'avance à un MJ ; saisi dans l'application, il relie le téléphone à son compte MJ et à son pseudo.
_Avoid_: Code d'inscription, code d'invitation

**MJ** · `GameMaster`:
Personne connue des Organisateurs avant la convention, qui mène des parties ; elle ne joue pas sur le ou les créneaux où elle mène une partie, et peut jouer sur les autres.
_Avoid_: Meneur, GM, animateur, Gm (abrégé)

**Organisateur** · `Organizer`:
Personne connue avant la convention, qui programme les scénarios sur les créneaux et les tables, ouvre les inscriptions et lance les tirages.
_Avoid_: Admin, staff

## Répartition

**Ouverture des inscriptions** · `openSignUps`:
Moment, le jour de la convention, où un Organisateur permet aux participants de commencer à s'inscrire.

**Inscription** · `SignUp`:
Le fait, pour un participant, de se déclarer intéressé par une partie. Un participant peut s'inscrire à plusieurs parties d'un même créneau ; l'inscription n'est pas une garantie de jouer.
_Avoid_: Vœu, choix, réservation, Registration

**Partie très demandée** · `OversubscribedGame`:
Partie dont le nombre d'inscrits dépasse le nombre de places maximum.

**Tirage** · `Draw`:
Répartition aléatoire des participants inscrits sur les parties d'un créneau, en respectant leurs inscriptions, avec pour objectif que chaque inscrit puisse jouer. Son résultat reste provisoire tant qu'un Organisateur ne l'a pas publié.
_Avoid_: Loterie, matching, draft, Lottery

**Ajustement** · `Adjustment`:
Modification manuelle, par un Organisateur, du résultat provisoire d'un tirage (déplacer un participant, maintenir ou annuler une partie, programmer une partie depuis la réserve, relancer le tirage) avant sa publication.

**Publication du tirage** · `publishDraw`:
Moment où un Organisateur rend définitif le résultat d'un tirage ; les participants sont alors notifiés, et plus aucune partie ne peut être programmée sur ce créneau.
_Avoid_: Validation

**Affectation** · `Assignment`:
Résultat publié du tirage pour un participant : la partie (et donc la table) où il joue sur un créneau.
_Avoid_: Placement (réservé au verdict de placement), assignation

**Non placé** · `Unassigned`:
Participant inscrit sur un créneau qui n'a obtenu aucune affectation au tirage.
