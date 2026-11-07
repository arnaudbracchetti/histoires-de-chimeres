# Histoires de Chimères

Organisation d'une convention de jeu de rôle : les participants s'inscrivent sur les parties proposées, puis un tirage au sort les répartit sur les tables, créneau par créneau.

Chaque terme est suivi du terme anglais qui le désigne dans le code (ADR 0003). Les échanges se font avec le terme français.

## Programme

**Convention** · `Convention`:
L'événement dans son ensemble, sur une journée, découpé en créneaux. Elle se termine à la fin de son dernier créneau.

**Créneau** · `TimeSlot`:
Plage horaire de la journée, habituellement de 2h30, pendant laquelle se jouent les parties en parallèle. Les créneaux ne se chevauchent pas ; deux créneaux sont consécutifs quand aucun autre ne se place entre eux, même s'ils sont séparés par une pause (repas, etc.).
_Avoid_: Session, tour, slot (seul)

**Créneau terminé** · `hasEnded`:
Créneau dont l'heure de fin est passée.
_Avoid_: Clos, fini

**Journée** · `Day`:
La suite ordonnée des créneaux de la convention. Elle dit le rang de chaque créneau et quels créneaux sont consécutifs.
_Avoid_: Planning, grille, Programme (réservé aux parties programmées)

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
Un scénario programmé par un Organisateur sur un créneau (deux créneaux consécutifs pour un scénario double), à une table. Un même scénario peut donner plusieurs parties. Une partie a les places de son scénario.
_Avoid_: Session, jeu, table

**Programmer** · `schedule`:
Action d'un Organisateur qui fait d'un scénario une partie, en lui attribuant un créneau et une table.
_Avoid_: Ouvrir (réservé aux inscriptions), planifier

**Déprogrammer** · `unschedule`:
Action d'un Organisateur qui retire une partie du programme ; son scénario reste proposé.
_Avoid_: Annuler (réservé à la partie sous son minimum, après le tirage)

**Déplacer une partie** · `moveGame`:
Action d'un Organisateur qui change le créneau ou la table d'une partie ; elle reste la même partie. Une partie double se déplace par son premier créneau, et prend le créneau consécutif avec elle.

**Échanger deux parties** · `swapGames`:
Action d'un Organisateur qui met chacune de deux parties à la place de l'autre, en un seul geste ; chacune reste la même partie.
_Avoid_: Permuter, intervertir

**Programme** · `Schedule`:
L'ensemble des parties programmées de la convention.

**Changement du Programme** · `ScheduleChange`:
L'écart entre le Programme d'avant et celui d'après un geste d'un Organisateur (programmer, déplacer, échanger, déprogrammer). On en tire les notifications du geste : une partie retirée, passée sur d'autres créneaux ou nouvelle a les siennes ; une partie restée sur les mêmes créneaux n'en a aucune (NO-1 à NO-4).

**Partie double** · `TwoSlotGame`:
Partie qui occupe deux créneaux consécutifs ; ses joueurs sont les mêmes sur les deux créneaux.
_Avoid_: DoubleGame

**Réserve** · `Reserve`:
Les scénarios qui pourraient être programmés sur un créneau : leur MJ y est disponible et n'y mène aucune partie (sur ce créneau et le suivant pour un scénario double). Un scénario déjà programmé sur un autre créneau en fait partie. L'Organisateur y puise pour soulager un créneau surchargé.

**Verdict de placement** · `Placement`:
Pour une case du programme (un créneau et une table), ce que donnerait le geste de programmer un scénario ou de déplacer une partie : permis, ou refusé avec son motif. Il obéit à la même règle que le geste lui-même. Pour déplacer une partie, la première case d'une autre partie propose de l'échanger avec elle (`MovePlacement`, `swapWith`).

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

**Téléphone relié** · `LinkedPhone`:
Téléphone sur lequel une personne s'est identifiée par un pseudo, et qui agit en son nom (inscriptions, notifications) jusqu'à ce que le lien soit coupé. On le relie à un pseudo (`link`) ; on coupe le lien (`unlink`).
_Avoid_: Session, appareil, connexion

**Notification** · `Notification`:
Message envoyé aux téléphones reliés à un pseudo, que le téléphone affiche même quand l'application est fermée.
_Avoid_: Push, alerte (réservé à ce que la page affiche elle-même : un message d'erreur, ou l'alerte de changement de NO-5, application ouverte)

**Fusionner** · `merge`:
Geste d'un Organisateur qui fait passer les inscriptions et le résultat des tirages d'un pseudo de participant sur un autre pseudo, puis supprime le premier.
_Avoid_: Report, transfert, regrouper

**Code de présence** · `PresenceCode`:
Code unique de la convention, fixé à sa création, que le QR code affiché sur place transmet au téléphone. Sans lui, on ne peut pas s'identifier, donc pas entrer dans le front office ; avec lui, on entre à toute heure, jusqu'à la fin de la convention. Il n'identifie personne.
_Avoid_: Code de salle, code d'accès, code d'accès anticipé, mot de passe

**MJ** · `GameMaster`:
Personne connue des Organisateurs avant la convention, qui mène (`lead`) des parties ; elle ne joue pas sur le ou les créneaux où elle mène une partie, et peut jouer sur les autres. Un MJ est un participant, qui a en plus ce rôle : son pseudo est celui de son participant.
_Avoid_: Meneur, GM, animateur, Gm (abrégé)

**Organisateur** · `Organizer`:
Personne connue avant la convention, qui programme les scénarios sur les créneaux et les tables, et lance les tirages.
_Avoid_: Admin, staff

## Répartition

**Inscription** · `SignUp`:
Le fait, pour un participant, de se déclarer intéressé par une partie. Un participant peut s'inscrire à plusieurs parties d'un même créneau ; l'inscription n'est pas une garantie de jouer. On s'inscrit (`signUp`) ; on se désinscrit (`withdraw`).
_Avoid_: Vœu, choix, réservation, Registration

**Inscription active** · `ActiveSignUp`:
Inscription prise en compte dans le nombre d'inscrits, la demande, « très demandée », le suivi et le tirage. Celle d'un MJ sur un créneau où il mène une partie ne l'est pas tant qu'il y mène ; elle reste en place et redevient active quand il n'y mène plus (IN-4). Un MJ peut en prendre sur un tel créneau, sauf à sa propre partie, au cas où sa partie serait annulée. Celle d'un joueur placé dans une partie double, une fois son tirage publié, ne l'est plus sur une partie qui commence sur le second créneau de la partie double (TI-3) ; son inscription à la partie double elle-même reste active.
_Avoid_: Inscription qui compte, inscription suspendue

**Partie très demandée** · `OversubscribedGame`:
Partie dont le nombre d'inscrits dépasse le nombre de places maximum.

**Partie sûre** · `SafeGame`:
Partie dont le nombre d'inscrits est entre ses places minimum et maximum.

**Demande** · `Demand`:
Nombre de participants qui ont au moins une inscription active sur un créneau, ou qui y sont sans partie. Un participant inscrit à plusieurs parties du créneau compte pour un.

**Participant sans partie** · `ParticipantWithoutGame`:
Participant qui reste dans le tirage d'un créneau sans aucune inscription active sur ce créneau : un Organisateur a déprogrammé sa partie, ou l'a déplacée sur un autre créneau, et c'était sa dernière inscription active ; ou c'est le MJ d'une partie annulée, sans autre inscription active sur le créneau. Il cesse de l'être dès qu'il s'inscrit à une partie du créneau, s'il se retire du tirage ou, pour le MJ, quand sa partie est rétablie.
_Avoid_: Inscription au créneau, en attente

**Se retirer du tirage** · `withdrawFromDraw`:
Geste du participant sans partie qui quitte le tirage d'un créneau, sur son téléphone, tant que ses inscriptions sont ouvertes.
_Avoid_: Se désinscrire (réservé à une inscription)

**Capacité** · `Capacity`:
Places d'un créneau : de la somme des places minimum à la somme des places maximum des parties qui y commencent.
_Avoid_: Plancher

**Avertissement de suivi** · `SignUpWarning`:
Signal qui attire l'œil d'un Organisateur, avant le tirage, sur un créneau, une partie ou un participant qui demande peut-être un ajustement : places qui manquent, trop de parties, partie sous son minimum, participant qui risque de rester sans table.
_Avoid_: Avertissement (seul, réservé aux avertissements de contenu), alerte
Exception : dans la tuile d'un créneau, le compteur dit « avertissements » tout court (« 2 avertissements »).

**Tirage** · `Draw`:
Répartition aléatoire des participants inscrits sur les parties d'un créneau, en respectant leurs inscriptions, avec pour objectif que chaque inscrit puisse jouer. Son résultat reste provisoire tant qu'un Organisateur ne l'a pas publié.
_Avoid_: Loterie, matching, draft, Lottery

**Lancer le tirage** · `launchDraw`:
Geste d'un Organisateur qui ferme les inscriptions d'un créneau et produit le résultat provisoire de son tirage. Il ne se lance que sur le premier créneau dont le tirage n'est pas publié.
_Avoid_: Démarrer, exécuter

**Relancer le tirage** · `rerunDraw`:
Geste d'un Organisateur qui refait le tirage provisoire d'un créneau à partir des inscriptions actives : les déplacements de participants sont effacés, les parties annulées le restent.
_Avoid_: Retirer, refaire

**Rouvrir les inscriptions** · `reopenSignUps`:
Geste d'un Organisateur qui efface le tirage provisoire d'un créneau, parties annulées comprises, et rouvre ses inscriptions, pour un tirage lancé par erreur ou trop tôt.
_Avoid_: Annuler le tirage (« annuler » est réservé à la partie)

**Algorithme de tirage** · `DrawAlgorithm`:
Le calcul qui produit le résultat d'un tirage à partir des seuls participants du créneau, de leurs inscriptions et des places de ses parties (TI-4). Il est remplaçable (ADR 0014).

**Ajustement** · `Adjustment`:
Modification manuelle, par un Organisateur, du résultat provisoire d'un tirage (déplacer un participant, annuler une partie sous son minimum ou la rétablir, programmer une partie depuis la réserve, relancer le tirage) avant sa publication.

**Déplacer un participant** · `moveParticipant`:
Ajustement qui change l'affectation provisoire d'un participant : vers une autre partie du créneau, même une où il n'est pas inscrit et au-delà de son maximum, ou vers les non placés (« Retirer de sa table »).
_Avoid_: Réaffecter, Déplacer une partie (réservé au programme)

**Déplacé à la main** · `movedByHand`:
Participant dont l'affectation provisoire vient d'un déplacement par un Organisateur, et non de l'algorithme. Relancer le tirage efface ces déplacements.

**Annuler une partie** · `cancelGame`:
Geste d'un Organisateur qui retire du tirage provisoire une partie sous son minimum : elle ne sera pas jouée, et son MJ redevient participant sur ses créneaux. L'annulation se défait en rétablissant la partie, jusqu'à la publication, qui déprogramme la partie annulée. Une partie qui n'est pas annulée est maintenue.
_Avoid_: Déprogrammer (avant le tirage), supprimer

**Rétablir une partie** · `restoreGame`:
Geste d'un Organisateur qui défait l'annulation d'une partie, avant la publication : elle revient sans joueur, et son MJ quitte le tirage.
_Avoid_: Réactiver, désannuler

**Signal du tirage** · `DrawSignal`:
Signal qui attire l'œil d'un Organisateur sur le résultat provisoire d'un tirage : non placés, parties sous leur minimum, parties au-delà de leur maximum, parties sans joueur. Après le lancement, il remplace les avertissements de suivi du créneau.
_Avoid_: Avertissement de suivi (réservé à avant le tirage), alerte

**Publication du tirage** · `publishDraw`:
Moment où un Organisateur rend définitif le résultat d'un tirage ; les participants sont alors notifiés, et plus aucune partie ne peut être programmée sur ce créneau.
_Avoid_: Validation

**Affectation** · `Assignment`:
Résultat du tirage pour un participant, provisoire ou publié : la partie (et donc la table) où il joue sur un créneau.
_Avoid_: Placement (réservé au verdict de placement), assignation

**Non placé** · `Unassigned`:
Participant du tirage d'un créneau, inscrit ou sans partie, qui n'a obtenu aucune affectation.
