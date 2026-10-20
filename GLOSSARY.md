# Histoires de Chimères

Organisation d'une convention de jeu de rôle : les participants s'inscrivent sur les parties proposées, puis un tirage au sort les répartit sur les tables, créneau par créneau.

Chaque terme est suivi du terme anglais qui le désigne dans le code (ADR 0003). Les échanges se font avec le terme français.

## Programme

**Convention** · `Convention`:
L'événement dans son ensemble, découpé en créneaux.

**Créneau** · `TimeSlot`:
Plage horaire de 2h30 pendant laquelle se jouent les parties en parallèle. Deux créneaux peuvent être séparés par une pause (repas, etc.).
_Avoid_: Session, tour, slot (seul)

**Scénario** · `Scenario`:
Ce qu'un MJ propose de faire jouer : un contenu (titre, jeu, univers, présentation), un nombre de places minimum et maximum, et une durée d'un ou deux créneaux.
_Avoid_: Module, aventure, proposition

**Jeu** · `System`:
Le jeu de rôle publié (règles et univers) sur lequel repose un scénario, par exemple L'Appel de Cthulhu.
_Avoid_: Game (réservé à la partie)

**Disponibilité** · `Availability`:
Créneau sur lequel un MJ déclare pouvoir mener.

**Partie** · `Game`:
Un scénario programmé par un Organisateur sur un créneau (deux créneaux consécutifs pour un scénario double), à une table. Un même scénario peut donner plusieurs parties.
_Avoid_: Session, jeu, table

**Programmer** · `schedule`:
Action d'un Organisateur qui fait d'un scénario une partie, en lui attribuant un créneau et une table.
_Avoid_: Ouvrir (réservé à l'ouverture des inscriptions), planifier

**Programme** · `Schedule`:
L'ensemble des parties programmées de la convention.

**Partie double** · `TwoSlotGame`:
Partie qui occupe deux créneaux consécutifs ; ses joueurs sont les mêmes sur les deux créneaux.
_Avoid_: DoubleGame

**Réserve** · `Reserve`:
Les scénarios proposés qui pourraient être programmés sur un créneau, leur MJ y étant disponible, mais qui ne le sont pas. L'Organisateur y puise pour soulager un créneau surchargé.

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
_Avoid_: Placement, assignation

**Non placé** · `Unassigned`:
Participant inscrit sur un créneau qui n'a obtenu aucune affectation au tirage.
