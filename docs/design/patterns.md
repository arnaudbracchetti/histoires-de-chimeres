# Patterns du back office

Le back office se conçoit pour un portable, à **1280 px de large et plus**. En dessous de 1280 px, le rail se replie de lui-même. En dessous de 1024 px, rien n'est garanti : le back office ne vise ni la tablette ni le téléphone.

Comportement et accessibilité viennent du CDK et d'Angular Aria, le dessin est en CSS natif ([ADR 0006](../adr/0006-interface-sans-bibliotheque-de-composants.md), [ecriture-css.md](ecriture-css.md)).

## Coquille

- **Rail latéral permanent, repliable.** Replié, il ne garde que les icônes, avec le libellé en infobulle et en nom accessible. Il est déplié par défaut, et son état est mémorisé par navigateur (`localStorage`).
- **Haut du rail** : l'emblème et « Histoires de Chimères », puis la convention en cours (nom et date, ou « date à fixer »), qui mène à « Créneaux et tables ».
- **Sections**, une page chacune :
  - **Préparation** : Calendrier (écran d'accueil), MJ, Scénarios, Créneaux et tables ;
  - **Jour J** : Pilotage du jour J, Participants. Leur place est prise, grisée, avec « à venir ».
- **Bas du rail** : l'utilisateur. Avant l'authentification, « Organisateur, sans authentification ».
- **La fiche d'un MJ** (MJ › pseudo) regroupe ses scénarios, ses disponibilités et ses parties. C'est le seul écran restreint à un MJ : il deviendra tout son espace avec l'authentification, sans le rail des Organisateurs ni le calendrier.

## En-tête de page

- Un **fil d'Ariane** dès le second niveau : « MJ › Kaïros », « Scénarios › La Tour d'ébène ».
- Le **titre** (h1) en Uncial Antiqua.
- À droite, **une seule action principale**. Les autres actions de la page sont dans un menu « ⋯ ».

## Boutons

| Bouton | Dessin | Usage |
|---|---|---|
| **Principal** | orange plein, texte charbon | l'action principale, une seule par vue |
| **Secondaire** | contour en filet, texte clair | les autres actions visibles |
| **Discret** | texte seul | « Annuler », « Effacer le filtre » |
| **Destructeur** | rouge plein, texte clair | **uniquement** dans un dialogue de confirmation |

- Une entrée de menu destructrice (« Supprimer le scénario ») est écrite en rouge brique.
- Un bouton à icône seule a toujours un nom accessible (`aria-label`) et une infobulle.
- Un bouton n'est **jamais désactivé** pour signaler une saisie incomplète (voir [Formulaires](#formulaires)).

## Formulaires

### Où se fait la saisie

- **Créneau** : une **carte par créneau**, dans l'ordre de la journée, et la pause entre deux cartes (voir [Créneaux](#créneaux)).
- **Table** : une **petite carte par table**, sur une grille, dans l'ordre naturel (voir [Tables](#tables)).
- **MJ** : une ligne en saisie en bas du tableau, ouverte par « Ajouter un MJ » sous le tableau (voir [MJ](#mj)). Sa ligne mène à sa fiche. Son pseudo se modifie dans l'en-tête de la fiche (crayon, puis champ en place, Entrée ou Échap), jamais dans la liste.
- **Scénario** : il a **sa propre page**, en lecture puis en édition. Il se crée depuis la fiche de son MJ, qui lui est fixé dès la création (PR-16), et s'ouvre aussi depuis la liste des scénarios.
- **Dialogues** (`@angular/cdk/dialog`) : réservés aux confirmations et aux dialogues de placement de la programmation. Jamais de formulaire de saisie dans un dialogue.

### Créneaux

Forme retenue sur prototype, face au tableau, au formulaire fixe, à la frise de la journée et au tableur : c'est celle où l'on voit le mieux ce qu'on fait et où l'on en est.

- **Une carte par créneau** : l'icône du sablier, « Créneau 2 », sa plage (« 14 h 00 – 16 h 30 ») et sa durée, avec deux boutons visibles, « Modifier » (secondaire) et « Supprimer » (discret, rouge brique). Leur nom accessible nomme le créneau : « Modifier le créneau 2 ».
- **Entre deux cartes**, la pause : « pause de 30 min », ou « bout à bout ».
- **« Modifier »** retourne la carte en saisie, marquée « Saisie en cours », bordée d'orange : titre « Modifier le créneau 2 », champs Début et Fin, durée, « Enregistrer » (principal) et « Annuler » (discret). Les autres cartes s'estompent le temps de la saisie. Une seule carte en saisie à la fois.
- **« Ajouter un créneau »**, une carte en pointillés en bas de la liste, ouvre une carte « Nouveau créneau ». Le début proposé est la fin du dernier créneau, la fin 2 h 30 après le début, tant qu'on ne l'a pas saisie. Le bouton principal dit « Ajouter le créneau ».
- **Saisie à la chaîne** : après un ajout, une nouvelle carte de saisie s'ouvre aussitôt, focus sur son début. « Annuler », ou Échap, la ferme.
- Entrée dans un champ enregistre, Échap ferme la saisie.
- **Focus** : à l'ouverture, sur le début ; après un enregistrement, sur la carte ; après « Annuler », sur ce qui a ouvert la saisie ; après une suppression, sur la carte suivante, à défaut la précédente, à défaut « Ajouter un créneau ».

### Tables

Forme retenue sur prototype, face au tableau à ligne en édition, aux étiquettes et au champ d'ajout permanent : le geste des créneaux, en plus compact. Ce qu'on saisit et ses boutons restent au même endroit.

- **Une petite carte par table**, sur une grille de colonnes fixes, dans l'ordre naturel (« Table 2 » avant « Table 10 ») : l'icône des dés, le nom, « Modifier » (secondaire) et « Supprimer » (discret, rouge brique). Leur nom accessible nomme la table : « Modifier la table Dragon ».
- **« Modifier »** retourne la carte en saisie, bordée d'orange, **à la même taille** : le champ du nom, « Enregistrer » (principal) et « Annuler » (discret). Les autres cartes s'estompent. Une seule carte en saisie à la fois.
- **« Ajouter une table »**, une carte en pointillés en dernier, ouvre une carte de saisie vide. Le bouton principal dit « Ajouter la table ».
- **Saisie à la chaîne** : après un ajout, une nouvelle carte vide s'ouvre aussitôt, focus sur le nom. « Annuler », ou Échap, la ferme.
- **L'erreur** s'affiche dans une bulle sous la carte, par-dessus la rangée suivante, sans couvrir les boutons : aucune carte ne bouge.
- **Focus** : comme pour les créneaux.

### MJ

Forme retenue sur prototype, face au champ d'ajout permanent, au champ « Chercher ou créer » et à la saisie en lot : la ligne en saisie du tableau.

- **La liste** est un tableau (voir [Tableaux](#tableaux)) : le pseudo, lien vers la fiche, triable, avec un filtre texte au-dessus. Le filtre ignore la casse et les accents.
- **« Ajouter un MJ »** (secondaire), **sous le tableau**, ouvre une ligne « Nouveau MJ » en dernier : le champ du pseudo, « Ajouter » (principal) et « Annuler » (discret). Le filtre s'efface pour montrer tous les MJ. Le bouton disparaît le temps de la saisie.
- **Saisie à la chaîne** : après un ajout, le MJ prend sa place dans l'ordre naturel et une ligne vide s'ouvre aussitôt, focus sur le pseudo. « Annuler », ou Échap, la ferme ; le focus revient à « Ajouter un MJ ».
- La ligne en saisie est centrée et garde la hauteur des autres. Elle est la dernière du tableau : **son erreur s'affiche en bulle juste dessous**, comme pour une table, sans rien couvrir ni décaler.
- **La fiche** : « MJ › pseudo ». Un crayon à côté du titre (« Modifier le pseudo ») remplace le h1 par le champ, avec « Enregistrer » et « Annuler ». Entrée enregistre, Échap ferme, le refus s'affiche sous le champ, et le focus revient au crayon. « Supprimer le MJ » est dans le menu « ⋯ » de l'en-tête.
- **Sans MJ**, l'état vide gravé invite à « Créer le premier MJ », qui ouvre la ligne de saisie.

### Icône de carte

Une carte de créneau ou de table s'ouvre sur son icône : une icône Lucide orange (`--accent`) sur un carré arrondi de 32 px (`--surface-3`), décorative. Sablier (`hourglass`) pour un créneau, dés (`dices`) pour une table.

### Champs

- Un composant « champ » commun : libellé au-dessus, aide sous le champ, erreur sous l'aide sur une ligne réservée (voir [Une erreur ne décale rien](#une-erreur-ne-décale-rien)), reliées par `aria-describedby`.
- **Heure** : un champ texte `hh:mm`, sur 24 heures, qui accepte aussi « 9:30 », « 14h » et « 14h30 » et les remet en « 14:30 ». Jamais `<input type="time">` : son format suit la langue du navigateur, et passe en AM/PM dans un navigateur anglais.
- Les champs **facultatifs** portent la mention « facultatif » ; il n'y a pas d'astérisque.
- Un **compteur** (« 42 / 80 ») accompagne les champs limités : titre, jeu, présentation, avertissements de contenu. Leurs bornes sont les constantes de `contract`.

### Validation

- **Une erreur locale** (obligatoire, longueur, 1 ≤ minimum ≤ maximum) s'affiche quand on **quitte le champ**, puis se met à jour à chaque frappe. Ses messages sont écrits côté front.
- Le bouton « Enregistrer » n'est **jamais désactivé**. S'il reste des erreurs, l'envoi est bloqué et le focus va au premier champ en erreur.
- **Une erreur de l'API rattachée à un champ** s'affiche sous ce champ (le `field` du Problem Details, avec des points pour l'imbrication : `seats.min`).
- **Une erreur de l'API sans champ** (422 hors champ, 409, 500, coupure réseau) s'affiche en notification (voir [Erreur hors formulaire](#erreur-hors-formulaire)), avec son `title` et son `detail`. Pour un 500 : « Une erreur est survenue, réessaie. » La saisie est conservée.
- Dans une ligne en édition, l'erreur s'affiche sous la cellule concernée. Une valeur manquante n'y est signalée qu'à la tentative d'enregistrement : quitter un champ vide pour cliquer « Annuler », « Enregistrer » ou « ⋯ » n'affiche rien. Une valeur mal écrite (« 25:00 ») l'est dès qu'on quitte le champ.

### Une erreur ne décale rien

L'apparition d'une erreur ne change jamais la mise en page : aucun champ, bouton ou ligne ne bouge. Sinon, quitter un champ pour cliquer un bouton fait apparaître une erreur qui déplace le bouton, et le clic tombe à côté.

- **Sous un champ**, la ligne de l'erreur est réservée : elle reste vide tant qu'il n'y a pas d'erreur.
- **Dans une carte en saisie** à plusieurs champs (créneau), la ligne de l'erreur est réservée sous chaque champ. Dans une carte compacte à un seul champ (table), l'erreur s'affiche dans une bulle sous la carte. Une bulle ne couvre jamais les boutons, et ni la carte ni ses boutons ne bougent.
- **Dans un tableau** :
  - toutes les lignes ont la même hauteur, ligne en édition comprise ;
  - les colonnes ont une largeur fixe, assez large pour les champs de la ligne en édition et pour « Nouveau … » ;
  - l'erreur s'écrit dans le bas de sa ligne, par-dessus. Elle peut déborder sur les cellules voisines de sa ligne, jamais sur la ligne suivante.
- **Pas de bandeau** en haut d'un formulaire : une erreur sans place réservée passe en notification, par-dessus la page.
- Un test Playwright vérifie, pour chaque écran à formulaire, que les boutons et les colonnes restent en place quand une erreur apparaît.

### Enregistrement

- **Jamais d'enregistrement automatique** dans un formulaire : un bouton « Enregistrer » (sous le tableau pour une ligne), ou Entrée dans une ligne.
- Pendant l'envoi, le bouton passe en « Enregistrement… » et refuse un second envoi. Dans une ligne, Échap et « Annuler » sont alors sans effet : l'enregistrement en cours n'est pas perdu.
- Après succès, un formulaire de page affiche « Enregistré » à côté du bouton pendant quelques secondes.
- **Quitter la page d'un scénario avec des modifications non enregistrées** ouvre « Quitter sans enregistrer ? ». Quitter la page pendant l'édition d'une ligne abandonne la saisie sans rien demander.
- **Exception : les cases à cocher de geste** (les blocs de la frise des disponibilités) s'enregistrent dès qu'on les coche. Voir [Disponibilités](#disponibilités).

### Image d'un scénario

- L'image **ne fait pas partie de « Enregistrer »** : elle part dès qu'elle est choisie, par ses propres endpoints ([ADR 0007](../adr/0007-images-de-scenario-stockees-en-base.md)).
- Elle ne s'ajoute **qu'une fois le scénario créé**. À la création, la zone image dit « Tu pourras ajouter une image après l'enregistrement. »
- La zone montre l'aperçu 3:2, ou l'illustration par défaut, le bouton « Choisir une image », et accepte aussi le dépôt d'un fichier (une alternative au bouton, pas l'inverse). Elle rappelle : « JPEG, PNG, WebP ou AVIF, 10 Mo au plus. L'image est recadrée en 3:2 au centre. »
- Pendant l'envoi, une barre de progression. Ensuite, l'aperçu est **celui que renvoie le serveur**, donc recadré.
- Une erreur (413, 415, 422) s'affiche sous la zone.
- Actions : « Remplacer », et « Retirer l'image », qui demande confirmation.

### Présentation (Markdown restreint)

- Un `<textarea>` simple, sans barre d'outils.
- Un aide-mémoire sous le champ : « **gras**, *italique*, « - » en début de ligne pour une liste ».
- Une bascule « Écrire / Aperçu » montre le rendu tel que le front office l'affichera.

## Tableaux

- `<table>` natif, lignes de 48 px, ligne en édition comprise (vignette de 32 px), colonnes de largeur fixe, en-tête collant.
- **Tri** au clic sur l'en-tête, indiqué par `aria-sort`. Tri et filtres sont des signaux, côté front.
- **Filtre texte** au-dessus des listes longues (scénarios, MJ).
- **Pas de pagination** : quelques dizaines de MJ, une ou deux centaines de scénarios au plus.
- La **cellule principale** est un lien vers la fiche ; toute la ligne réagit au survol.
- Les **actions secondaires** d'une ligne passent par un menu « ⋯ » en bout de ligne (motif Menu d'Aria), et non par une rangée d'icônes.
- Les **nombres** sont en chiffres à chasse fixe, alignés à droite.
- Listes de l'Organisateur :
  - MJ : pseudo, nombre de scénarios, disponibilités par créneau, parties menées. Les disponibilités sont des ronds numérotés de même taille, un par créneau : plein en orange si le MJ peut y mener une partie, cerclé sinon, sans icône ;
  - scénarios : vignette, titre, jeu, MJ, places, durée, parties. Lignes de 40 px autour de vignettes de 32 px, triables par titre, jeu et MJ.

## Chargement, état vide, erreur de lecture

- **Chargement** : rien pendant 300 ms, puis une fine barre de progression indéterminée en haut de la zone de contenu, avec `aria-busy` sur cette zone. Pas de squelettes.
- **Échec d'une lecture** : à la place du contenu, un message sobre, sans motif gravé (« Impossible de charger les scénarios. »), et un bouton « Réessayer ».
- **État vide** : motif gravé, une phrase (l'humour discret y a sa place) et une invitation à créer, en bouton principal.
  - Convention sans créneau : le calendrier invite d'abord à créer les créneaux, « Ou commencer par les MJ » en second.
  - Créneaux sans table : le calendrier invite à ajouter les tables.
  - Aucun MJ : la page invite à créer le premier MJ.
  - Aucun scénario : la page renvoie vers la fiche d'un MJ pour en créer un.
- **Filtre sans résultat** : sobre, sans motif. « Aucun scénario ne correspond », et « Effacer le filtre ».

## Actions destructrices

| Action | Confirmation |
|---|---|
| Supprimer un créneau, une table, un MJ, un scénario | oui |
| Retirer l'image d'un scénario | oui |
| Déprogrammer une partie | non : c'est l'inverse de programmer, et le geste est fréquent |
| Retirer une disponibilité | non : c'est une case à cocher |
| Revenir aux places du scénario | non |

- **Le dialogue de confirmation** :
  - pose une question qui nomme l'objet : « Supprimer le créneau 2 ? » ;
  - dit ce qui part avec lui : « Ses 4 disponibilités seront supprimées. » (PR-10, PR-12) ;
  - propose « Annuler » (discret) et un bouton destructeur qui nomme l'action : « Supprimer le créneau » ;
  - met le focus initial sur « Annuler ».
- **Aucune annulation après coup**, nulle part.
- Déprogrammer une partie aux places modifiées perd ces places, sans confirmation.
- **Refus du domaine** (PR-10, PR-12, PR-14 : un objet qui porte des parties) : l'action reste proposée, le front ne devine pas la règle. Le refus arrive de l'API et s'affiche **dans le dialogue de confirmation lui-même**, avec son `detail` : « Le créneau 2 porte 3 parties : déprogramme-les d'abord. » Le bouton destructeur disparaît, il ne reste que « Fermer ».

## Retours d'action

### Succès

- **Pas de notification de succès** : le résultat se voit (la ligne apparaît, la partie change de case). Seul un formulaire de page affiche « Enregistré ».
- Chaque écriture réussie est **annoncée aux lecteurs d'écran** par une région `aria-live="polite"` commune à la coquille : « Partie déplacée : créneau 2, table Dragon. »
- **Pendant une écriture déclenchée par un geste** (glisser-déposer, case à cocher), l'élément prend tout de suite son nouvel état, atténué, jusqu'à la réponse. Refusé, il revient à son état précédent.

### Erreur hors formulaire

Un geste de programmation refusé après une course, une déprogrammation qui échoue, un 500, une coupure réseau, et toute erreur d'un formulaire qui n'est rattachée à aucun champ.

- Une **notification** en bas à droite, `role="alert"` : le `title` en gras, le `detail` dessous, un bouton ✕.
- Une erreur **reste affichée jusqu'à ce qu'on la ferme**. Les notifications s'empilent, trois au plus : au-delà, la plus ancienne se ferme.
- Après un refus 422 ou un conflit 409, l'écran **recharge la convention**. Pour le 409 : « La convention a changé entre-temps : l'écran est à jour. »
- Coupure réseau : « Pas de connexion : rien n'a été enregistré. »
- Les fronts ne lisent le `code` d'un Problem Details que pour décider d'un comportement (409 → recharger), jamais pour écrire un message ([ADR 0008](../adr/0008-le-domaine-donne-un-code-l-api-ecrit-le-message.md)).

## Statuts

Pensés dès maintenant pour le pilotage du jour J (demande / capacité, PRD §4.4), sans en concevoir les écrans.

| Rôle | Jeton | Icône Lucide | Sens |
|---|---|---|---|
| Vert | `--success` | `circle-check` | correct, complet |
| Jaune | `--warning` | `triangle-alert` | attention : la demande approche de la capacité |
| Rouge brique | `--danger` | `octagon-alert` | surcharge, erreur |
| Neutre | `--text-muted` sur `--surface-3` | propre au sens : `pencil` (places modifiées), `clock` (à venir), `inbox` (en réserve) | information sans jugement : « double », « places modifiées », « à venir », « en réserve » |

- Une forme d'icône par couleur : aucune information ne passe par la couleur seule. Un statut a **toujours une icône et un libellé**.
- **Deux formes seulement** :
  - **pastille** : icône et libellé, en ligne, dans un tableau ;
  - **badge** : fond teinté à 14 % et libellé, en pilule, dans une carte.
- **Jamais un bouton plein** : les statuts voisinent avec l'orange des actions. Seul le bouton destructeur est rouge plein.
- Un **ratio demande / capacité** s'écrit « 42 / 36 », en chiffres à chasse fixe, à côté de sa pastille.
- Les **seuils** du jaune et du rouge relèvent de l'effort du jour J. La charte n'en fixe que le sens.

## Focus

- Anneau de focus bleu (`--focus`), de 2 px, décalé de 2 px, toujours visible au clavier (`:focus-visible`).
- **Dialogue fermé** : le focus revient à l'élément qui l'a ouvert.
- **Après une suppression** : le focus va à la ligne (ou la carte) suivante, à défaut à la précédente, à défaut à l'en-tête du tableau (ou au bouton d'ajout).
- **Après une navigation** : le focus va au h1 de la nouvelle page.
- **Après un geste de programmation** : le focus va à la partie, à sa nouvelle place.

## Programmation

La page Calendrier est l'écran d'accueil et le lieu de la programmation.

### Frise

- **Le temps court vers la droite.** Une colonne par créneau, de largeur proportionnelle à sa durée (environ 0,8 px par minute). Les pauses forment des colonnes étroites, avec leur durée. Une ligne par table.
- En-têtes de créneau et de table en capitales espacées (Aldrich).
- **Partie** : une carte avec sa vignette de 32 px, son titre, son jeu, son MJ et ses places. Un crayon signale des places modifiées.
- **Partie double** : une seule carte, étendue sur ses deux créneaux, par-dessus la pause qui les sépare.
- **Barre d'aide** au-dessus de la frise : elle donne la phrase complète du motif de la cible survolée pendant un geste.

### Bac de réserve

Sous la frise, filtré au choix :

- par créneau, chaque filtre portant son nombre de scénarios ;
- sur « Tous les scénarios », avec une pastille par statut, qui liste ses créneaux : « Programmé : créneau 1 », « En réserve : créneaux 2, 3 et 4 ». Le bac est la seule carte qui porte des pastilles. Un scénario ni en réserve ni programmé nulle part est grisé, avec sa raison : par exemple celui d'un MJ sans disponibilité.

Vignettes de 44 px. Dans un filtre de créneau, un scénario programmé ailleurs porte « Déjà programmé : créneau 1 ».

Chaque carte : vignette, titre et méta en tête, jusqu'au bord ; dessous, sur toute la largeur, les pastilles puis « Programmer sur… », calé à droite. Trois cartes dans la largeur de la frise, chacune à sa hauteur.

### Fiche de la partie

- Un clic sur une partie ouvre sa fiche dans un **panneau latéral non modal** à droite de la frise, qui se rétrécit. Échap ou ✕ la ferme, et le focus revient à la partie.
- Contenu : vignette, jeu, MJ, créneau ou créneaux, table, places, « Déplacer vers… », « Déprogrammer ».
- **Places (PR-4)** : minimum et maximum, avec « Celles du scénario : elles suivent ses changements », ou « Modifiées · scénario : 3 à 5 » et « Revenir à celles du scénario ».
- Ce motif de fiche latérale ne sert qu'à la partie. MJ et scénarios ont leur page.

### Aucune action réservée au glisser-déposer

Le glisser-déposer (`@angular/cdk/drag-drop`) sert la souris et le tactile. Chaque action a aussi un chemin par bouton et menu, utilisable au clavier comme à la souris (WCAG 2.2, critère 2.5.7). Il n'y a pas de glisser-déposer au clavier.

| Action | Glisser-déposer | Autre chemin |
|---|---|---|
| Programmer | scénario de la réserve → case | « Programmer sur… » sur le scénario de la réserve ; « Programmer ici » sur une case libre |
| Déplacer une partie | partie → case | fiche → « Déplacer vers… » |
| Échanger deux parties | partie → partie | fiche → « Déplacer vers… » → case occupée → « Échanger » |
| Déprogrammer | partie → bac de réserve | fiche → « Déprogrammer » |
| Modifier les places | — | fiche |

- **« Programmer sur… » et « Déplacer vers… »** ouvrent un dialogue de placement : une grille créneaux × tables. Chaque case est soit « Choisir » (ou « Échanger »), soit éteinte avec son motif.
- **« Programmer ici »** ouvre la liste des scénarios programmables sur cette case, puis, en dessous, ceux qui ne le sont pas, chacun avec sa raison.
- **Pas d'annulation** après un geste : on refait le geste inverse.

### Signalement des cibles (PR-5)

- Pendant un glisser-déposer, **les cibles valides s'éclairent** (halo orange) et **les cibles refusées restent éteintes**, avec un motif court : « MJ indisponible », « MJ déjà occupé », « Table prise », « Pas de créneau suivant ».
- Au survol d'une cible, la barre d'aide donne la phrase complète : « Kaïros mène déjà « Néons sur Neo-Paris » sur le créneau 1. »
- Les dialogues de placement reprennent les mêmes motifs.
- Motifs et phrases sont le `title` et le `detail` des verdicts de placement, lus dans l'API au début du geste et à l'ouverture d'un dialogue. Le front ne recalcule pas PR-5.
- La programmation garantit PR-5 à chaque écriture : il n'y a aucune violation à afficher en dehors d'un geste.

### Disponibilités

Sur la fiche du MJ, la **frise de la journée** : un bloc par créneau, à sa place et à sa durée, sous les heures pleines. Un bloc coché dit « Je peux mener une partie », les autres « Pas disponible ». Au-dessus, « Toute la journée » et « Aucun créneau ».

- **Chaque bloc s'enregistre dès qu'on clique dessus** : c'est un geste, une case à cocher (« Créneau 1 · 9 h 00 – 12 h 30 ») sous son dessin. Pendant l'écriture, le bloc est atténué ; refusé, il revient à son état.
- **Un créneau court reste lisible** : il garde une largeur minimale, prise sur les pauses. Son texte rétrécit (de 13 à 11 px), la plage passe à la ligne entre début et fin, sans couper une heure, puis « Créneau » se réduit au rang et l'état à son icône.
- Une disponibilité sur laquelle le MJ mène une partie (PR-15) est **cochée et verrouillée**, avec son motif : « Mène « Néons sur Neo-Paris » », et la table en dessous. Ce verdict vient de la lecture de la fiche, calculé par le domaine ; le front ne recode pas la règle.
