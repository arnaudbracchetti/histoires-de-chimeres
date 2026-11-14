# Patterns

Cette page décrit les patterns du back office. Une partie vaut aussi pour le front office, qui en adapte le dessin au téléphone dans [patterns-front-office.md](patterns-front-office.md).

| Vaut pour les deux fronts                                                                                                                                                                         | Propre au back office                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Boutons](#boutons) : une seule action principale par vue, un nom accessible pour une icône seule, aucun bouton désactivé pour une saisie incomplète. Le front office a son propre jeu de dessins | [Coquille](#coquille), [En-tête de page](#en-tête-de-page)                                                                                                                                        |
| [Champs](#champs), [Validation](#validation), [Une erreur ne décale rien](#une-erreur-ne-décale-rien), [Enregistrement](#enregistrement) (pendant l'envoi, un second envoi est refusé)            | [Où se fait la saisie](#où-se-fait-la-saisie) : cartes, lignes et pages de saisie                                                                                                                 |
| [Actions destructrices](#actions-destructrices) : le dialogue de confirmation, le refus dans le dialogue                                                                                          | [Tableaux](#tableaux)                                                                                                                                                                             |
| [Erreur hors formulaire](#erreur-hors-formulaire), sauf son dessin : un dialogue ici, une alerte en bas de l'écran sur le téléphone                                                               | [Chargement, état vide, erreur de lecture](#chargement-état-vide-erreur-de-lecture), jusqu'aux premiers écrans du front office qui en ont besoin                                                  |
| [Succès](#succès) : pas d'alerte de succès, annonce aux lecteurs d'écran                                                                                                                          | [Programmation](#programmation), [Pilotage du jour J](#pilotage-du-jour-j), [Informations de connexion](#informations-de-connexion), [Onglets de classeur](#onglets-de-classeur), [Jauge](#jauge) |
| [Statuts](#statuts), [Focus](#focus)                                                                                                                                                              |                                                                                                                                                                                                   |

## Le back office sur l'écran

Le back office se conçoit pour un portable, à **1280 px de large et plus**. En dessous de 1280 px, le rail se replie de lui-même. En dessous de 1024 px, rien n'est garanti : le back office ne vise ni la tablette ni le téléphone.

**Deux gabarits de page**, pour qu'une action ne s'isole jamais loin de son contenu sur un grand écran :

- **La colonne** (par défaut) : 60rem (`--page-width`), alignée à gauche contre le rail, pas centrée. L'en-tête suit la même colonne : son fond court sur toute la largeur, mais son action de droite tombe au-dessus du bord droit du contenu. Le corps porte la classe `.page-body`. Les tableaux prennent toute la largeur de la colonne ; un formulaire garde sa largeur de lecture (32 à 40rem) à l'intérieur.
- **La pleine largeur** (`<app-page-header width="full">`) : seulement pour les pages qui montrent la journée entière ou s'en servent, le Calendrier, le Pilotage du jour J et les Informations de connexion.
- **Une action d'ajout se place sous ce qu'elle ajoute**, à gauche : « Ajouter un MJ » sous le tableau des MJ, « Proposer un scénario » sous la liste des scénarios d'un MJ. Seule l'action principale de la page va dans l'en-tête.

Comportement et accessibilité viennent du CDK et d'Angular Aria, le dessin est en CSS natif ([ADR 0006](../adr/0006-interface-sans-bibliotheque-de-composants.md), [ecriture-css.md](ecriture-css.md)).

## Coquille

- **Rail latéral permanent, repliable.** Replié, il ne garde que les icônes, avec le libellé en infobulle et en nom accessible. Il est déplié par défaut, et son état est mémorisé par navigateur (`localStorage`).
- **Haut du rail** : l'emblème et « Histoires de Chimères », puis la convention en cours (nom et date, ou « date à fixer »), qui mène à « Créneaux et tables » pour un Organisateur.
- **Sections**, une page chacune :
  - **Préparation** : Calendrier (écran d'accueil), MJ, Scénarios, Créneaux et tables ;
  - **Jour J** : Pilotage du jour J, Participants, Informations de connexion.
- **Rail selon le compte** : un MJ seul a un rail réduit, sans titre de section : **Ma fiche** (son accueil, `house`) et **Scénarios de la convention**. Un MJ qui est aussi Organisateur a le rail complet, précédé de la section **Mon espace MJ** → Ma fiche. Pas de bascule d'espace.
- **Gestes masqués** : un geste ne s'affiche que si le niveau d'accès du descripteur de son endpoint l'ouvre au compte connecté (`canCall()`, ADR 0017). Une page réservée aux Organisateurs ouverte par URL par un MJ seul affiche « Accès refusé », sans changer l'adresse ; l'accueil (`/gestion/`) le mène à Ma fiche.
- **Bas du rail** : le pseudo de la personne connectée, qui mène à « Mon compte » (changer son mot de passe : le mot de passe actuel, puis le nouveau, une seule fois), et « Se déconnecter ». Sans session, « Se connecter », qui mène à la page de connexion.
- **Page de connexion** (`/gestion/connexion`), hors du rail : pseudo et mot de passe. La boîte est ancrée en haut de la page, pas centrée : elle ne grandit que vers le bas. Un refus de l'API, coupure réseau comprise, s'écrit dans la boîte, sous le bouton, à la place de l'aide « Mot de passe oublié ? … » : le `title` en gras, le `detail` à la suite, en rouge brique, lu aux lecteurs d'écran. Pas de dialogue : une faute de frappe se corrige tout de suite. Le pseudo est gardé, le mot de passe vidé, le focus dessus. Rien ne bouge au-dessus du refus. Un pseudo inconnu et un mauvais mot de passe y donnent le même message (ADR 0018). C'est la seule exception à [Erreur hors formulaire](#erreur-hors-formulaire).
- **Page d'un lien d'accès** (`/gestion/lien-d-acces/<jeton>`), hors du rail, dans la même boîte que la connexion : « Lune, choisis ton mot de passe », « Tu te connecteras ensuite avec ton pseudo, Lune, et ce mot de passe. », puis le champ « Pseudo » en lecture seule, grisé, qui porte `autocomplete="username"` pour que le gestionnaire de mots de passe du navigateur enregistre la paire, puis le mot de passe, une seule fois, le focus dessus, avec l'aide « De 10 à 128 caractères, espaces compris : une courte phrase convient. », et **Choisir ce mot de passe**. Ouvrir la page ne consomme pas le lien ; le mot de passe choisi, la personne est connectée et arrive à l'accueil : le calendrier pour un Organisateur, Ma fiche pour un MJ seul. Un lien inconnu, déjà utilisé ou expiré remplace le formulaire par le motif de l'API, la phrase en rouge brique, et « Aller à la connexion » (ADR 0018).
- **La fiche d'un MJ** (MJ › pseudo) regroupe ses scénarios, ses disponibilités et ses parties. C'est aussi l'espace du MJ lui-même, **Ma fiche** (`/gestion/ma-fiche`), voir [MJ](#mj).

## En-tête de page

- Un **fil d'Ariane** dès le second niveau : « MJ › Kaïros », « Scénarios › La Tour d'ébène ».
- Le **titre** (h1) en Uncial Antiqua.
- À droite, **une seule action principale**. Les autres actions de la page sont dans un menu « ⋯ ».

## Boutons

| Bouton          | Dessin                                            | Usage                                           |
| --------------- | ------------------------------------------------- | ----------------------------------------------- |
| **Principal**   | orange plein, texte charbon                       | l'action principale, une seule par vue          |
| **Secondaire**  | fond gris éclairci, filet gris clair, texte clair | les autres actions visibles                     |
| **Discret**     | texte seul                                        | « Annuler », « Effacer le filtre »              |
| **Destructeur** | rouge plein, texte clair                          | **uniquement** dans un dialogue de confirmation |

- Une entrée de menu destructrice (« Supprimer le scénario ») est écrite en rouge brique.
- Un bouton à icône seule a toujours un nom accessible (`aria-label`) et une infobulle.
- Un bouton n'est **jamais désactivé** pour signaler une saisie incomplète (voir [Formulaires](#formulaires)).

## Formulaires

### Où se fait la saisie

- **Créneau** : une **carte par créneau**, dans l'ordre de la journée, et la pause entre deux cartes (voir [Créneaux](#créneaux)).
- **Table** : une **petite carte par table**, sur une grille, dans l'ordre naturel (voir [Tables](#tables)).
- **Pseudo, MJ compris** : l'assistant « Créer un pseudo », en dialogue (voir [Participants](#participants)), ouvert par « Créer un pseudo » dans la liste Participants et par « Ajouter un MJ » sous le tableau des MJ. Seule façon de créer un pseudo, et donc un MJ. La ligne d'un MJ mène à sa fiche. Son pseudo se modifie dans l'en-tête de la fiche (crayon, puis champ en place, Entrée ou Échap), jamais dans la liste.
- **Scénario** : il a **sa propre page**, en lecture puis en édition. Il se crée depuis la fiche de son MJ, qui lui est fixé dès la création (PR-16), et s'ouvre aussi depuis la liste des scénarios.
- **Dialogues** (`@angular/cdk/dialog`) : réservés aux confirmations, aux dialogues de placement de la programmation et à l'assistant « Créer un pseudo ». Aucun autre formulaire de saisie dans un dialogue.

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

- **La liste** est un tableau (voir [Tableaux](#tableaux)) : le pseudo, lien vers la fiche, triable, avec un filtre texte au-dessus. Le filtre ignore la casse et les accents.
- **« Ajouter un MJ »** (secondaire), **sous le tableau**, ouvre l'assistant « Créer un pseudo » (voir [Participants](#participants)), le rôle MJ coché d'avance. La liste est relue à sa fermeture.
- **La fiche** : « MJ › pseudo ». Un crayon à côté du titre (« Modifier le pseudo ») remplace le h1 par le champ, avec « Enregistrer » et « Annuler ». Entrée enregistre, Échap ferme, le refus s'affiche sous le champ, et le focus revient au crayon. « Supprimer le MJ » est dans le menu « ⋯ » de l'en-tête.
- **Trois onglets de classeur** (voir [Onglets de classeur](#onglets-de-classeur)) : Scénarios (par défaut, « Proposer un scénario » en bouton principal sous la liste), Disponibilités (la frise, sur la largeur de la colonne, et le compteur « déclarés / créneaux » sur l'onglet), Parties (créneau, scénario, table).
- **Ma fiche** : la fiche du MJ connecté, titrée par son pseudo, sans crayon, sans « ⋯ » ni fil d'Ariane. Ses onglets : Mes scénarios, Mes disponibilités, Mes parties. Un MJ seul qui ouvre sa fiche par `/gestion/mj/<id>` arrive sur Ma fiche.
- **Scénarios de la convention** (la liste des scénarios, pour un MJ) : un filtre « Tous / Les miens » à côté du filtre texte. Le MJ d'un autre scénario s'affiche sans lien, et la page de ce scénario se lit seulement : image, jeu, places, durée, avertissements, présentation rendue, sans « ⋯ » ni formulaire.
- **Sans MJ**, l'état vide gravé invite à « Créer le premier MJ », qui ouvre l'assistant comme « Ajouter un MJ ».

### Icône de carte

Une carte de créneau ou de table s'ouvre sur son icône : une icône Lucide orange (`--accent`) sur un carré arrondi de 32 px (`--surface-3`), décorative. Sablier (`hourglass`) pour un créneau, dés (`dices`) pour une table.

### Champs

- Un composant « champ » commun : libellé au-dessus, aide sous le champ, erreur sous l'aide sur une ligne réservée (voir [Une erreur ne décale rien](#une-erreur-ne-décale-rien)), reliées par `aria-describedby`.
- **Heure** : un champ texte `hh:mm`, sur 24 heures, qui accepte aussi « 9:30 », « 14h » et « 14h30 » et les remet en « 14:30 ». Jamais `<input type="time">` : son format suit la langue du navigateur, et passe en AM/PM dans un navigateur anglais.
- **Mot de passe** : toujours une seule saisie, jamais de second champ de confirmation. Un œil (`eye`, bouton à icône seule, « Afficher le mot de passe », `aria-pressed`) dans le champ, à droite, l'affiche en clair, puis l'icône devient `eye-off`. L'envoi du formulaire le remasque. Composant `app-password-reveal`, autour de l'`input`.
- Les champs **facultatifs** portent la mention « facultatif » ; il n'y a pas d'astérisque.
- Un **compteur** (« 42 / 80 ») accompagne les champs limités : titre, jeu, présentation, avertissements de contenu. Leurs bornes sont les constantes de `contract`.

### Validation

- **Une erreur locale** (obligatoire, longueur, 1 ≤ minimum ≤ maximum) s'affiche quand on **quitte le champ**, puis se met à jour à chaque frappe. Ses messages sont écrits côté front.
- Le bouton « Enregistrer » n'est **jamais désactivé**. S'il reste des erreurs, l'envoi est bloqué et le focus va au premier champ en erreur.
- **Une erreur de l'API rattachée à un champ** s'affiche sous ce champ (le `field` du Problem Details, avec des points pour l'imbrication : `seats.min`).
- **Une erreur de l'API sans champ** (422 hors champ, 409, 500, coupure réseau) s'affiche dans le dialogue d'erreur (voir [Erreur hors formulaire](#erreur-hors-formulaire)), avec son `title` et son `detail`. Pour un 500 : « Une erreur est survenue, réessaie. » La saisie est conservée.
- Dans une ligne en édition, l'erreur s'affiche sous la cellule concernée. Une valeur manquante n'y est signalée qu'à la tentative d'enregistrement : quitter un champ vide pour cliquer « Annuler », « Enregistrer » ou « ⋯ » n'affiche rien. Une valeur mal écrite (« 25:00 ») l'est dès qu'on quitte le champ.

### Une erreur ne décale rien

L'apparition d'une erreur ne change jamais la mise en page : aucun champ, bouton ou ligne ne bouge. Sinon, quitter un champ pour cliquer un bouton fait apparaître une erreur qui déplace le bouton, et le clic tombe à côté.

- **Sous un champ**, la ligne de l'erreur est réservée : elle reste vide tant qu'il n'y a pas d'erreur.
- **Dans une carte en saisie** à plusieurs champs (créneau), la ligne de l'erreur est réservée sous chaque champ. Dans une carte compacte à un seul champ (table), l'erreur s'affiche dans une bulle sous la carte. Une bulle ne couvre jamais les boutons, et ni la carte ni ses boutons ne bougent.
- **Dans un tableau** :
  - toutes les lignes ont la même hauteur, ligne en édition comprise ;
  - les colonnes ont une largeur fixe, assez large pour les champs de la ligne en édition et pour « Nouveau … » ;
  - l'erreur s'écrit dans le bas de sa ligne, par-dessus. Elle peut déborder sur les cellules voisines de sa ligne, jamais sur la ligne suivante.
- **Pas de bandeau** en haut d'un formulaire : une erreur sans place réservée passe dans le dialogue d'erreur, par-dessus la page.
- Un test Playwright vérifie, pour chaque écran à formulaire, que les boutons et les colonnes restent en place quand une erreur apparaît.

### Enregistrement

- **Jamais d'enregistrement automatique** dans un formulaire : un bouton « Enregistrer » (sous le tableau pour une ligne), ou Entrée dans une ligne.
- Pendant l'envoi, le bouton passe en « Enregistrement… » et refuse un second envoi. Dans une ligne, Échap et « Annuler » sont alors sans effet : l'enregistrement en cours n'est pas perdu.
- Après succès, un formulaire de page affiche « Enregistré » à côté du bouton pendant quelques secondes.
- **Quitter la page d'un scénario avec des modifications non enregistrées** ouvre « Quitter sans enregistrer ? ». Quitter la page pendant l'édition d'une ligne abandonne la saisie sans rien demander.
- **Exception : les cases à cocher de geste** (les blocs de la frise des disponibilités) s'enregistrent dès qu'on les coche. Voir [Disponibilités](#disponibilités).

### Image d'un scénario

- L'image **ne fait pas partie de « Enregistrer »** : elle part dès qu'elle est choisie, par ses propres endpoints ([ADR 0007](../adr/0007-images-de-scenario-stockees-en-base.md)).
- **Sa propre colonne**, à droite du formulaire (20rem, le formulaire 40rem au plus) : l'aperçu sur toute la largeur, puis le rappel et les boutons. Même place pour l'illustration de la page en lecture seule et pour la zone de « Nouveau scénario ». Trop étroite, la page passe l'image sous le contenu. Dans le formulaire, Titre et Jeu partagent une ligne, comme Places minimum, Places maximum et Durée : à 1280 × 800, « Enregistrer » reste dans l'écran.
- Elle ne s'ajoute **qu'une fois le scénario créé**. À la création, la zone image dit « Tu pourras ajouter une image après l'enregistrement. »
- La zone montre l'aperçu 3:2, ou l'illustration par défaut, le bouton « Choisir une image », et accepte aussi le dépôt d'un fichier (une alternative au bouton, pas l'inverse). Elle rappelle : « JPEG, PNG, WebP ou AVIF, 10 Mo au plus. L'image est recadrée en 3:2 au centre. »
- Pendant l'envoi, une barre de progression. Ensuite, l'aperçu est **celui que renvoie le serveur**, donc recadré.
- Une erreur (413, 415, 422) s'affiche sous la zone.
- Actions : « Remplacer », et « Retirer l'image », qui demande confirmation.

### Présentation (Markdown restreint)

- Un `<textarea>` simple, sans barre d'outils.
- Un aide-mémoire sous le champ : « **gras**, _italique_, « - » en début de ligne pour une liste ».
- Une bascule « Écrire / Aperçu » montre le rendu tel que le front office l'affichera.

## Tableaux

- `<table>` natif, lignes de 48 px, ligne en édition comprise (vignette de 32 px), colonnes de largeur fixe, en-tête collant.
- **Tri** au clic sur l'en-tête, indiqué par `aria-sort`. Tri et filtres sont des signaux, côté front.
- **Filtre texte** au-dessus des listes longues (scénarios, MJ). La liste « Participants » cherche par l'API, voir [Participants](#participants).
- **Pas de pagination** : quelques dizaines de MJ, une ou deux centaines de scénarios au plus.
- La **cellule principale** est un lien vers la fiche ; toute la ligne réagit au survol.
- Les **actions secondaires** d'une ligne passent par un menu « ⋯ » en bout de ligne (motif Menu d'Aria), et non par une rangée d'icônes.
- Les **nombres** sont en chiffres à chasse fixe, alignés à droite.
- Listes de l'Organisateur :
  - MJ : pseudo, nombre de scénarios, disponibilités par créneau, parties menées. Les disponibilités sont des ronds numérotés de même taille, un par créneau : plein en orange si le MJ peut y mener une partie, cerclé sinon, sans icône ;
  - scénarios : vignette, titre, jeu, MJ, places, durée, parties. Lignes de 40 px autour de vignettes de 32 px, triables par titre, jeu et MJ ;
  - participants : voir [Participants](#participants).

## Chargement, état vide, erreur de lecture

- **Chargement** : rien pendant 300 ms, puis une fine barre de progression indéterminée en haut de la zone de contenu, avec `aria-busy` sur cette zone. Pas de squelettes.
- **Échec d'une lecture** : à la place du contenu, un message sobre, sans motif gravé (« Impossible de charger les scénarios. »), et un bouton « Réessayer ». Un refus faute de droit (403) affiche le titre et le texte de l'API, sans « Réessayer ».
- **État vide** : motif gravé, une phrase (l'humour discret y a sa place) et une invitation à créer, en bouton principal.
  - Convention sans créneau : le calendrier invite d'abord à créer les créneaux, « Ou commencer par les MJ » en second.
  - Créneaux sans table : le calendrier invite à ajouter les tables.
  - Aucun MJ : la page invite à créer le premier MJ.
  - Aucun scénario : la page renvoie un Organisateur vers les MJ, et invite un MJ à « Proposer un scénario ».
- **Filtre sans résultat** : sobre, sans motif. « Aucun scénario ne correspond », et « Effacer le filtre ».

## Actions destructrices

| Action                                                         | Confirmation                                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Supprimer un créneau, une table, un MJ, un scénario, un pseudo | oui                                                                                                                                         |
| Retirer l'image d'un scénario                                  | oui                                                                                                                                         |
| Programmer une partie                                          | oui, sur un créneau en tirage provisoire, qu'elle efface (TI-6) ; sinon, non                                                                |
| Déprogrammer une partie                                        | oui, si elle a des inscrits, ou si son créneau est en tirage provisoire ; sinon, non                                                        |
| Déplacer une partie vers un autre créneau                      | oui, si elle a des inscrits, ou si l'un des deux créneaux est en tirage provisoire ; vers une autre table du même créneau, non (IN-6, TI-6) |
| Échanger deux parties de créneaux différents                   | oui, si l'une a des inscrits, ou si l'un des deux créneaux est en tirage provisoire ; sur le même créneau, non (IN-6, TI-6)                 |
| Lancer le tirage                                               | oui, en orange (principal) : le geste n'efface rien, mais ferme les inscriptions                                                            |
| Relancer le tirage                                             | oui, s'il a des déplacements à la main, qu'elle efface ; sans déplacement, non                                                              |
| Rouvrir les inscriptions d'un créneau en tirage                | oui : le résultat provisoire est effacé                                                                                                     |
| Programmer depuis la réserve un créneau en tirage              | oui : le tirage provisoire est effacé                                                                                                       |
| Annuler une partie dans le tirage                              | oui : ses joueurs passent dans les non placés ; « Garder la partie » ferme                                                                  |
| Rétablir une partie annulée                                    | non : elle revient sans joueur, rien d'autre ne part                                                                                        |
| Ajouter un retardataire à un tirage publié                     | oui, en orange (principal) : le geste n'efface rien, mais ne se défait pas (ID-14)                                                          |
| Retirer une disponibilité                                      | non : c'est une case à cocher                                                                                                               |
| Revenir aux places du scénario                                 | non                                                                                                                                         |

- **Le dialogue de confirmation** :
  - pose une question qui nomme l'objet : « Supprimer le créneau 2 ? » ;
  - dit ce qui part avec lui, en un ou plusieurs paragraphes : « Ses 4 disponibilités seront supprimées. » (PR-10, PR-12) ;
  - pour un geste qui retire des inscriptions, pose le chiffre, puis la conséquence : « Il y a 12 inscrits à la partie. Ils perdront leur inscription et seront notifiés. », puis, à la ligne, « 3 d'entre eux n'ont pas d'autre inscription sur le créneau : ils restent dans le tirage du créneau, mais sans être inscrits à aucune partie. » (absente à 0, IN-6). Au singulier : « Il y a 1 inscrit à la partie. Il perdra son inscription et sera notifié. », puis « C'est sa seule inscription sur le créneau : il reste dans le tirage du créneau, mais sans être inscrit à aucune partie. » Une partie double ajoute ses créneaux (« à la partie (créneaux 2 et 3) »). Un échange donne ces phrases pour chaque partie touchée, nommée : « Il y a 4 inscrits à « Néons » (créneau 2). ». Une déprogrammation ajoute « Le scénario revient en réserve, sans ses inscriptions. » ;
  - pour un geste de programmation dont le verdict dit qu'il efface un tirage provisoire (TI-6), ajoute, après les paragraphes des inscriptions retirées et avant « Le scénario revient en réserve… » : « Le tirage provisoire du créneau 2 sera effacé, avec ses déplacements et ses parties annulées. Les inscriptions sur ce créneau seront rouvertes. » Par le bouton comme par le glisser-déposer. Programmer y pose « Programmer « Néons » sur le créneau 2, Licorne ? », avec « Programmer la partie » ;
  - s'en tient aux chiffres de l'API (inscriptions actives, IN-4) : ni pseudos, ni places restantes. « Déplacer vers… » ne les annonce pas sur ses cases, qui gardent leur seul verdict PR-5 ;
  - sur la page de pilotage, reprend à chaque relecture les chiffres du suivi des mêmes parties, sans se fermer ; un nombre retombé à 0 donne « Aucun inscrit ne perd son inscription. » (« Aucun inscrit de « Néons » (créneau 2) ne perd son inscription. » dans un échange). Le Calendrier, qui ne se relit pas, garde les chiffres lus au geste. Le geste retire les inscriptions présentes au moment de l'écriture ;
  - propose « Annuler » (discret) et un bouton destructeur qui nomme l'action : « Supprimer le créneau ». Quand l'action elle-même commence par « Annuler », le bouton qui ferme reprend la question à l'inverse : « Garder la partie » face à « Annuler la partie » ;
  - met le focus initial sur le bouton qui ferme.
- **Aucune annulation après coup**, nulle part.
- **Refus du domaine** (PR-10, PR-12, PR-14 : un objet qui porte des parties) : l'action reste proposée, le front ne devine pas la règle. Le refus arrive de l'API et s'affiche **dans le dialogue de confirmation lui-même**, avec son `detail` : « Le créneau 2 porte 3 parties : déprogramme-les d'abord. » Le bouton destructeur disparaît, il ne reste que « Fermer ».

## Retours d'action

### Succès

- **Pas d'alerte de succès** : le résultat se voit (la ligne apparaît, la partie change de case). Seul un formulaire de page affiche « Enregistré ».
- Chaque écriture réussie est **annoncée aux lecteurs d'écran** par une région `aria-live="polite"` commune à la coquille : « Partie déplacée : créneau 2, table Dragon. »
- **Pendant une écriture déclenchée par un geste** (glisser-déposer, case à cocher), l'élément prend tout de suite son nouvel état, atténué, jusqu'à la réponse. Refusé, il revient à son état précédent.

### Erreur hors formulaire

Un geste de programmation refusé après une course, une déprogrammation qui échoue, un 500, une coupure réseau, et toute erreur d'un formulaire qui n'est rattachée à aucun champ.

- Un **dialogue d'erreur**, modal, `role="alertdialog"`, dessiné comme le refus dans un dialogue de confirmation (voir [Actions destructrices](#actions-destructrices)) : le `title` en question, le `detail` dessous en rouge brique, et « Fermer » (discret), qui reçoit le focus.
- Le dialogue **reste ouvert jusqu'à « Fermer » ou Échap** ; le focus revient alors à l'élément qui avait le focus. Plusieurs erreurs s'ouvrent l'une après l'autre, dans leur ordre d'arrivée.
- Un refus dans un dialogue déjà ouvert (confirmation, placement, fusion) reste dans ce dialogue.
- Après un refus 422 ou un conflit 409, l'écran **recharge la convention**. Pour le 409 : « La convention a changé entre-temps : l'écran est à jour. »
- Coupure réseau : « Pas de connexion : rien n'a été enregistré. »
- Les fronts ne lisent le `code` d'un Problem Details que pour décider d'un comportement (409 → recharger), jamais pour écrire un message ([ADR 0008](../adr/0008-le-domaine-donne-un-code-l-api-ecrit-le-message.md)).

## Statuts

Pensés pour le pilotage du jour J (demande / capacité, PRD §4.4) et les autres écrans.

| Rôle          | Jeton                            | Icône Lucide                                                                | Sens                                                                                                                                                                                                 |
| ------------- | -------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vert          | `--success`                      | `circle-check` ; `lock` pour « Tirage publié »                              | correct, complet ; tirage publié                                                                                                                                                                     |
| Jaune         | `--warning`                      | `triangle-alert`                                                            | attention : la demande atteint 80 % de la capacité maximum, trop de parties, une partie reste sous son minimum ; après le lancement, une partie du tirage sous son minimum ou au-delà de son maximum |
| Rouge brique  | `--danger`                       | `octagon-alert`                                                             | surcharge (il manque des places, des participants sans partie, des participants risquent de ne pas être placés), erreur ; après le lancement, des non placés, une partie sans joueur                 |
| Neutre        | `--text-muted` sur `--surface-3` | propre au sens : `clock` (à venir), `inbox` (en réserve), `check` (terminé) | information sans jugement : « double », « à venir », « en réserve », « Terminé »                                                                                                                     |
| Bleu du focus | `--focus`                        | `lock-open`                                                                 | inscriptions ouvertes : seul usage du bleu hors du focus                                                                                                                                             |

- **Les quatre états d'un créneau**, partout dans le back office (pilotage, puis liste et fiche des pseudos) :

  | État                  | Couleur                               | Icône       | Quand                              |
  | --------------------- | ------------------------------------- | ----------- | ---------------------------------- |
  | Inscriptions ouvertes | bleu du focus (`--focus`)             | `lock-open` | aucun tirage lancé                 |
  | Tirage provisoire     | orange (`--accent`)                   | `hourglass` | tirage lancé, pas publié           |
  | Tirage publié         | vert (`--success`)                    | `lock`      | tirage publié, créneau pas terminé |
  | Terminé               | gris (`--text-muted`), ligne atténuée | `check`     | tirage publié, heure de fin passée |

  L'API donne l'état, terminé compris : les fronts ne le recalculent pas. La couleur de chaque état est écrite une seule fois, dans le `styles.css` du back office (`data-time-slot-state`, qui donne `--time-slot-state`) : la pastille de l'état et les ronds la lisent. Un créneau dont l'heure de fin est passée sans tirage publié garde son état, et ses gestes. Le libellé est toujours écrit : le lecteur d'écran l'entend, et l'icône reste décorative.

- Une forme d'icône par couleur : aucune information ne passe par la couleur seule. Un statut a **toujours une icône et un libellé**.
- **Deux formes seulement** :
  - **pastille** : icône et libellé, en ligne, dans un tableau, et pour l'état d'un créneau, sur sa tuile comme dans son résumé ;
  - **badge** : fond teinté à 14 % et libellé, en pilule, dans une carte.
- **Jamais un bouton plein** : les statuts voisinent avec l'orange des actions. Seul le bouton destructeur est rouge plein.
- Un **ratio demande / capacité** s'écrit « 42 / 36 », en chiffres à chasse fixe, à côté de sa pastille.
- Les **seuils** du suivi des inscriptions sont fixés, sans réglage : rouge dès que la demande dépasse la capacité maximum, jaune dès qu'elle en atteint 80 %. Les autres avertissements de suivi suivent leurs propres règles (voir [Pilotage du jour J](#pilotage-du-jour-j)).
- Après le lancement, les **signaux du tirage** remplacent les avertissements de suivi, avec les mêmes couleurs et les mêmes icônes (voir [Pilotage du jour J](#pilotage-du-jour-j)).
- **Pas de vert pour le suivi** : un créneau sans avertissement n'affiche rien de plus. L'absence de signal veut dire « rien à faire ».

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
- **Partie** : une carte avec sa vignette de 32 px, son titre, son jeu, son MJ et ses places.
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
- **Section « Inscrits »**, sur la page de pilotage seulement, après les actions : « 15 inscrits · 3 à 4 places », la [jauge](#jauge), les badges, puis « dont 8 sans autre inscription sur le créneau » (absent à 0).
  - Les pseudos y sont en deux groupes, dans l'ordre reçu : « Sans autre inscription sur le créneau · N », puis « Inscrits aussi ailleurs sur le créneau · N », où chacun porte « aussi : « Sous la surface » ». Chaque pseudo à risque a sa pastille (voir l'onglet Inscrits du créneau). Sans inscrit : « Aucun inscrit pour l'instant. »
  - Partie double : « Partie double : ses inscriptions comptent sur le créneau 3. »
  - Créneau dont le tirage est lancé ou publié : aucune action, et « Tirage publié : les inscriptions sont fermées. » (ou « Tirage en cours : … »).
  - Le Calendrier ne lit pas le suivi : sa fiche reste sans section « Inscrits ».
- **Places (PR-4)** : minimum et maximum, ceux du scénario, en lecture seule.
- Ce motif de fiche latérale ne sert qu'à la partie, dans le Calendrier comme dans le [pilotage du jour J](#pilotage-du-jour-j). MJ et scénarios ont leur page.

### Aucune action réservée au glisser-déposer

Le glisser-déposer (`@angular/cdk/drag-drop`) sert la souris et le tactile. Chaque action a aussi un chemin par bouton et menu, utilisable au clavier comme à la souris (WCAG 2.2, critère 2.5.7). Il n'y a pas de glisser-déposer au clavier.

| Action                | Glisser-déposer               | Autre chemin                                                                              |
| --------------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| Programmer            | scénario de la réserve → case | « Programmer sur… » sur le scénario de la réserve ; « Programmer ici » sur une case libre |
| Déplacer une partie   | partie → case                 | fiche → « Déplacer vers… »                                                                |
| Échanger deux parties | partie → partie               | fiche → « Déplacer vers… » → case occupée → « Échanger »                                  |
| Déprogrammer          | partie → bac de réserve       | fiche → « Déprogrammer »                                                                  |
| Modifier les places   | —                             | fiche                                                                                     |

- **« Programmer sur… » et « Déplacer vers… »** ouvrent un dialogue de placement : une grille créneaux × tables. Chaque case est soit « Choisir » (ou « Échanger »), soit éteinte avec son motif. « Échanger » n'apparaît que sur la première case d'une autre partie : la seconde case d'une partie double reste « Table prise ».
- **« Programmer ici »** ouvre la liste des scénarios programmables sur cette case, puis, en dessous, ceux qui ne le sont pas, chacun avec sa raison.
- **Pas d'annulation** après un geste : on refait le geste inverse.
- **Un geste qui retire des inscriptions** demande la même confirmation par le glisser-déposer que par le bouton (voir [Actions destructrices](#actions-destructrices)), avant toute écriture. Pendant le dialogue, la carte (les deux cartes d'un échange) se montre atténuée à sa nouvelle place ; « Annuler » la ramène à sa place. Un dépôt dans le bac lit d'abord les chiffres de la déprogrammation. Sans inscription retirée, le dépôt écrit aussitôt.

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

## Pilotage du jour J

La page « Pilotage du jour J » (`/pilotage`) suit les inscriptions de chaque créneau avant le tirage, lance le tirage et en montre le résultat (PRD §4.4, étapes 1, 3 et 4). Elle est disponible avant le jour J, sans condition de date. Le Calendrier reste l'écran d'accueil. Elle affiche ce que l'API calcule, sans recalcul.

- **En-tête** : h1 « Pilotage du jour J », et dessous une ligne réservée à l'âge des chiffres. Elle garde sa hauteur même vide : son texte, quand il vient, ne décale rien.
- **Bande des créneaux** : une tuile par créneau, dans l'ordre de la journée. C'est un bouton à `aria-pressed`, bordé d'orange quand le créneau est choisi.
  - Chaque tuile porte l'état de son créneau, en pastille (voir [Statuts](#statuts)).
  - Créneau dont les inscriptions sont ouvertes : « Créneau 2 », la plage, le ratio demande / capacité maximum en grand (« 26 / 22 »), la légende « participants / places », la [jauge](#jauge), « Inscriptions ouvertes » (`lock-open`, bleu du focus), puis le titre du plus grave des avertissements de suivi, le premier de la liste reçue, dans sa couleur et avec son icône, suivi du nombre des autres en gris (« Il manque 4 places +2 ») ; le lecteur d'écran entend « Il manque 4 places, et 2 autres avertissements ». Rien sans avertissement. Le titre est celui de l'API, tel quel.
  - Créneau en tirage provisoire : les placés face aux participants du tirage en grand (« 19 / 26 »), la légende « placés / participants », et « Tirage provisoire » (`hourglass`, orange), sans jauge ni compteur d'avertissements.
  - Créneau publié : les mêmes chiffres (« 19 / 26 », « placés / participants »), cadenas (`lock`, vert), « Tirage publié ».
  - Créneau terminé : tuile atténuée par ses couleurs, sans opacité (fond Anthracite 1, tout son texte en Texte secondaire), les mêmes chiffres, « Terminé » (`check`, gris).
  - À l'ouverture, la page choisit le premier créneau dont le tirage n'est pas publié. « Tirage en cours » ne s'emploie pas dans le back office : c'est le terme du front office.
- **Résumé du créneau choisi**, dans une carte : « Créneau 2 · 13 h 00 – 15 h 30 », sous le titre l'état du créneau en pastille, puis la demande (« 26 participants ») et la capacité (« 14 à 22 places », ou « 22 places » quand les deux bornes sont égales) en grand, et une jauge large.
  - Les **avertissements de suivi**, dans l'ordre reçu de l'API (trois au plus, les rouges d'abord), un par ligne : l'icône de son niveau, le titre en couleur, le détail en gris, et un bouton secondaire choisi selon le code, qui ouvre l'onglet où agir et y met le focus. L'API écrit le titre et le détail ; le front ne lit le code que pour choisir le bouton.

    | Code                             | Niveau | Titre (exemple)                                   | Bouton                                                                               |
    | -------------------------------- | ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
    | `seats-missing`                  | rouge  | « Il manque 4 places »                            | « Voir la réserve »                                                                  |
    | `participants-without-game`      | rouge  | « 3 participants sans partie »                    | « Voir les participants » (onglet Inscrits, puce « Sans partie »)                    |
    | `participants-may-not-be-placed` | rouge  | « 8 participants risquent de ne pas être placés » | « Voir les participants » (onglet Inscrits, puce « Risquent de ne pas être placés ») |
    | `nearly-full`                    | jaune  | « Presque plein », « Plein » à 100 %              | « Voir la réserve »                                                                  |
    | `too-many-games`                 | jaune  | « Trop de parties »                               | « Voir les parties »                                                                 |
    | `games-below-minimum`            | jaune  | « 3 parties sous leur minimum »                   | « Voir les parties »                                                                 |

  - Sans inscription : aucun avertissement, et « Aucune inscription sur ce créneau pour l'instant. » Les chiffres restent affichés, même à 0.
  - **Lancer le tirage** : sur le premier créneau dont le tirage n'est pas publié, le bouton principal « Lancer le tirage », sous les avertissements de suivi, qu'on lit avant de fermer les inscriptions. Sur les autres créneaux ouverts : « Le tirage de ce créneau se lance après la publication du créneau 2. » Le bouton ouvre une confirmation, en orange (principal) : « Lancer le tirage du créneau 2 ? », « 26 participants sont inscrits sur ce créneau, pour 14 à 22 places. », chaque avertissement de suivi (titre et détail), dans sa couleur et avec son icône, puis « Les inscriptions du créneau seront fermées. Personne n'est notifié avant la publication. » ; Annuler · **Lancer le tirage**. Le geste réussi est annoncé, et la page relit le suivi.
  - Créneau en tirage provisoire : « Tirage provisoire » (`hourglass`, orange), « 19 / 26 placés », « 7 non placés » et « 4 / 5 parties au minimum » en grand, puis les **signaux du tirage**, puis « Les inscriptions du créneau sont fermées. Personne n'est notifié avant la publication. » Aucun avertissement de suivi. Les signaux viennent dans l'ordre reçu de l'API (les rouges d'abord : non placés, parties sans joueur ; puis les jaunes : parties sous leur minimum, parties au-delà de leur maximum), un par ligne : l'icône de son niveau, le titre en couleur, le détail en gris, sans bouton. L'API écrit le titre et le détail (« 7 non placés », « Il reste 3 places dans les parties du créneau. »). Un tirage publié n'en a aucun. Ses gestes sont à droite du titre du résumé : « Relancer le tirage » (`rotate-ccw`), bouton secondaire avec icône, « Publier le tirage », le bouton principal, puis le menu « ⋯ » (« Autres actions sur le créneau ») : « Programmer depuis la réserve… », puis « Rouvrir les inscriptions », en rouge brique.
  - **Relancer le tirage** : aussitôt, sans dialogue, s'il n'y a aucun déplacement à la main ; un refus s'ouvre dans le dialogue d'erreur. Sinon, une confirmation rouge : « Relancer le tirage du créneau 2 ? », « Tes 3 déplacements seront effacés : le tirage repart des inscriptions. » (« Ton déplacement sera effacé : … » au singulier) ; Annuler · **Relancer le tirage**. Le geste réussi est annoncé, et la page relit le suivi.
  - **Programmer depuis la réserve…** : un dialogue montre la réserve du créneau, comme son onglet ; « Programmer ici… » sur une carte passe aux tables libres du créneau pour ce scénario, d'après ses verdicts de programmation (« Programmer sur Licorne »), avec « Retour à la réserve ». Le choix d'une table demande une confirmation rouge : « Programmer « X » sur le créneau 2, Licorne ? », « Le tirage provisoire sera effacé, avec ses déplacements et ses parties annulées, et les inscriptions du créneau 2 rouvertes. », « Tous ceux qui peuvent s'inscrire sur ce créneau reçoivent la notification « nouvelle partie », qui annonce la réouverture. Tu relanceras le tirage ensuite. » ; Annuler · **Programmer la partie**. Le geste réussi est annoncé, la page relit le suivi : le résumé du créneau ouvert et ses onglets reviennent, et le focus va au titre du résumé.
  - **Rouvrir les inscriptions** : une confirmation rouge : « Rouvrir les inscriptions du créneau 2 ? », « Le résultat provisoire sera effacé, avec ses déplacements et ses parties annulées. », « Personne n'est notifié : chacun retrouve ses inscriptions, et peut en changer jusqu'au prochain tirage. » ; Annuler · **Rouvrir les inscriptions**. Le geste réussi est annoncé, la page relit le suivi : le résumé du créneau ouvert et ses onglets reviennent, et le focus va au titre du résumé.
  - **Publier le tirage** : toujours actif, même quand une partie n'a aucun joueur : le refus s'affiche dans le dialogue. Une confirmation orange (principal) : « Publier le tirage du créneau 2 ? », « 19 participants sont placés, 7 ne le sont pas. Chacun reçoit sa notification, ainsi que les MJ. » (« 1 participant est placé. » sans non placé), puis en jaune, avec `triangle-alert`, chaque partie jouée hors de ses places : « « Brumes » est jouée au-delà de son maximum : 5 joueurs pour 4 places. », « « Néons » est jouée sous son minimum : 2 joueurs pour 3 places au moins. », puis, sans couleur, chaque partie annulée : « « Néons » est annulée : elle quitte le programme, et Kaïros, son MJ, reçoit la notification « partie annulée ». », et enfin « Le résultat ne pourra plus être modifié. » ; Annuler · **Publier le tirage**. Le geste réussi est annoncé, et la page relit le suivi.
  - Créneau publié : « Tirage publié » (`lock`, vert), ou « Terminé » (`check`, gris) une fois son heure de fin passée, les mêmes chiffres que le tirage provisoire, « Tirage publié : les participants et les MJ ont reçu leur notification, et le résultat ne change plus. », puis, s'il reste de la place, « Il reste de la place : Dragon (3 places). Les non placés vont voir leur MJ. ». Aucune action, et le plan de salle en lecture seule.
- **Plan de salle**, sous le résumé d'un créneau lancé, à la place des onglets : une carte « Non placés » en tête (fond teinté de rouge, « 7 participants · 3 places libres dans le créneau », les pseudos, puis, en texte secondaire, une ligne par MJ d'une partie annulée qui a des inscriptions sur le créneau : « Kaïros · inscrit à : « Brumes », « Néons » », TI-6, IN-4), puis une carte par partie du créneau, dans l'ordre des tables. Pas de carte pour une table libre. Les cartes ont 12 rem au moins et passent à la ligne, sans défilement horizontal.
  - Carte d'une partie : table, titre, « jeu · MJ », jauge, « 5 joueurs · 3 à 5 places · 1 place libre » (ou « · 1 de trop », en jaune), badges « double », « Sous son minimum » et « Au-delà du maximum » (jaunes, `triangle-alert`), puis ses joueurs en pastilles, dans l'ordre naturel des pseudos.
  - Pastille d'un joueur : crayon (`pencil`) et bordure en pointillés s'il a été déplacé à la main ; pseudo en jaune s'il joue à une partie où il n'est pas inscrit. Le lecteur d'écran entend les deux marques. Un participant sans partie (IN-6) n'a pas de mention sur sa pastille : le bandeau le dit quand on le choisit.
  - Second créneau d'une partie double : carte atténuée, « Partie double, tirée avec le créneau 3 », ses joueurs, en lecture seule.
  - **Annuler la partie** : sur un tirage provisoire, une partie qui a moins de joueurs que son minimum (sans joueur compris) porte « Annuler la partie » (discret, rouge), tout en bas de la carte. Pas de mention « Maintenue » : c'est le cas par défaut. Une confirmation rouge : « Annuler « Néons » ? », « Ses 2 joueurs passent dans les non placés, sans nouveau tirage. » (« Son joueur passe… » au singulier, rien sans joueur), « Kaïros, son MJ, redevient participant sur ce créneau et rejoint les non placés, avec son inscription à « Brumes ». » (« … sans partie. » sans inscription sur le créneau), « À la publication, son MJ reçoit la notification « partie annulée ». » ; **Garder la partie** · **Annuler la partie**. Le geste réussi est annoncé, et la page relit le suivi.
  - Partie annulée : carte atténuée, badge « Annulée » (`x`, rouge), « Ses joueurs sont passés dans les non placés. », sans jauge ni chiffres, et « Rétablir la partie » (discret), sans confirmation : la partie revient sans joueur et son MJ quitte le tirage. Un refus s'ouvre dans le dialogue d'erreur. Le geste réussi est annoncé, et la page relit le suivi.
  - **Déplacer un participant**, en deux clics, sans glisser-déposer. Un bandeau au-dessus du plan dit au repos « Choisis un joueur, puis sa nouvelle table. », avec la légende des marques. Un clic sur une pastille choisit le joueur (bordure orange, `aria-pressed`) ; un second clic, « Annuler » ou Échap défont le choix. Le bandeau dit alors « Bastou · inscriptions : « Néons ». Choisis sa nouvelle table. » (« Bastou · sans partie. … » pour un participant sans partie, dont toutes les cibles sont « pas inscrit »). Chaque autre carte d'une partie non annulée offre, tout en bas, à la même hauteur et de la même taille d'une carte à l'autre, « Déplacer ici · inscrit » (bordure orange) ou « Déplacer ici · pas inscrit » (pointillés gris), avec au-dessus « 5 joueurs pour 4 places » en jaune si le geste dépasse le maximum. La carte « Non placés » offre « Retirer de sa table » à un joueur placé. « Annuler la partie » et « Rétablir la partie » restent, juste au-dessus de la cible. Le geste part sans confirmation ; un refus s'ouvre dans le dialogue d'erreur, et garde le choix. Le geste réussi est annoncé (« Bastou déplacé : table Sphinx, « Néons ». », « Lune retiré de sa table. »), et la page relit le suivi. Le choix en cours survit à une relecture tant que le joueur reste dans le tirage.
  - Sur un tirage publié, le plan est en lecture seule : ni bandeau, ni choix de joueur, ni bouton. La carte d'une partie n'ouvre pas sa fiche.
- **Onglets du créneau**, sous le résumé, en [onglets de classeur](#onglets-de-classeur) : « Parties du créneau » (`dices`, nombre de parties qui commencent sur le créneau), « Inscrits du créneau » (`users`, la demande) et « Réserve du créneau » (`inbox`, nombre de scénarios programmables). Aucun onglet sur un créneau lancé.
- **Onglet Parties du créneau** : « 1 table libre » en tête, puis une ligne par table, dans l'ordre des tables.
  - Partie : nom de la table, vignette, titre (bouton qui ouvre la fiche, `aria-expanded` ; un clic n'importe où sur la ligne l'ouvre aussi), « jeu · MJ », jauge, « 15 inscrits · 3 à 4 places », suivi de son écart (« · 11 de trop », « · 1 manquant »), « dont 8 sans autre inscription sur le créneau » (absent à 0), puis les badges « double », « Très demandée » (neutre, `users`) et « Sous son minimum » (jaune, `triangle-alert`).
  - Table libre : ligne en pointillés, « Table libre » et « Programmer ici… ». Ce bouton ouvre un dialogue « Programmer sur le créneau 2, table Dragon », lu à l'ouverture dans les verdicts de la case : les scénarios programmables avec « Choisir », puis « Pas programmables ici · N », chacun atténué avec son motif (la carte du bac de réserve). Vide : « Aucun scénario programmable ici. » « Choisir » programme la partie, puis onglet Parties, focus sur sa ligne et annonce ; un refus s'affiche dans le dialogue, comme dans le dialogue de placement.
  - Second créneau d'une partie double : ligne atténuée, « Partie double, comptée sur le créneau 3 », sans chiffres.
- **Onglet Inscrits du créneau** : qui s'est inscrit où.
  - Puces de filtre, comme celles du bac de réserve : « Tous · 26 », « Sans partie · 3 », « Risquent de ne pas être placés · 16 », « Risquent de rester sans table · 2 ». Une puce à 0 n'apparaît pas ; si la puce choisie disparaît à une relecture, le filtre revient à « Tous ». Le filtre survit à la relecture et au changement d'onglet.
  - Un tableau : un pseudo par ligne (en-tête de ligne), une partie par colonne, dans l'ordre des tables. L'en-tête de colonne donne le titre (bouton qui ouvre la fiche, `aria-expanded`), « 15 inscrits · 3–4 » et les badges. Une coche (`check`) par inscription, avec « inscrit » pour les lecteurs d'écran. Chaque colonne de partie est centrée et bordée, et une sur deux est teintée, pour la suivre de haut en bas.
  - Trois groupes, dans l'ordre reçu de l'API : « Sans partie · N », puis « Une seule inscription · N », puis « Plusieurs inscriptions · N ». Un groupe vide après filtre n'apparaît pas. La ligne d'un participant sans partie n'a aucune coche.
  - La colonne « Avertissement » porte la pastille du risque : « Sans partie » (rouge, `octagon-alert`) quand un Organisateur lui a retiré sa dernière partie du créneau (IN-6), « Risque de ne pas être placé » (rouge, `octagon-alert`) quand toutes ses parties du créneau sont très demandées, ou « Risque de rester sans table » (jaune, `triangle-alert`) quand aucune n'est sûre et que l'une au moins est sous son minimum. Le MJ qui mène sur le créneau n'y figure pas (IN-4).
  - Sans inscription : « Aucune inscription sur ce créneau pour l'instant. »
- **Onglet Réserve du créneau** : les scénarios dont le MJ est disponible sur le créneau, et qui n'y ont aucune partie qui commence, dans l'ordre reçu de l'API (programmables d'abord, puis l'ordre naturel des titres).
  - En tête : « 4 scénarios programmables sur ce créneau, 5 autres en réserve. »
  - Une carte par scénario, comme dans le bac de réserve : vignette, titre, « jeu · MJ », badge « double ». « Déjà programmé : créneau 1 » quand il est programmé sur un autre créneau.
  - Programmable : « Programmer ici… », qui ouvre le dialogue de placement limité à la colonne du créneau.
  - Non programmable : carte atténuée, avec la phrase de son motif, sans action. Quand toutes les tables sont prises : « Toutes les tables sont prises sur le créneau 2. », sans autre proposition.
  - Vide : « Aucun scénario en réserve sur ce créneau. »
- **Fiche de la partie** : celle du Calendrier, à droite du créneau, qui se rétrécit. Sur un créneau dont le tirage est lancé, elle n'offre aucune action. Une partie qui disparaît du programme à une relecture ferme la fiche.
- **Gestes** : pas de glisser-déposer. On programme par « Programmer ici… » de l'onglet Réserve, on déplace par « Déplacer vers… » et on déprogramme par la fiche, avec la même confirmation que dans le Calendrier quand le geste retire des inscriptions (voir [Actions destructrices](#actions-destructrices)). Après chaque geste, réussi ou refusé comme périmé, la page relit le suivi.
  - Programmer : la page ouvre l'onglet Parties et met le focus sur la ligne de la nouvelle partie.
  - Déplacer ou échanger : la page choisit le créneau où la partie commence désormais, ouvre l'onglet Parties et met le focus sur sa ligne.
  - Déprogrammer : la fiche se ferme, et le focus va au titre du résumé du créneau.
  - Chaque geste réussi est annoncé par la région `aria-live` de la coquille, comme dans le Calendrier.
- La **demande** compte des participants distincts : un participant inscrit à trois parties du créneau compte pour un. La **capacité** est une fourchette, de la somme des places minimum à la somme des places maximum des parties qui commencent sur le créneau. Une partie double ne compte que sur son premier créneau.
- Les grands chiffres de la tuile et du résumé prennent `--font-size-title`, en police système, à chasse fixe.

## Participants

La liste des pseudos, de participant et de MJ (ID-5), dans l'ordre naturel.

- **Recherche** : la phrase « Tape quelques lettres du pseudo, ou du titre d'une partie où il est inscrit. », puis le filtre texte des tableaux (`app-table-filter`), « Pseudo ou titre d'une partie ». L'API cherche ces lettres dans le pseudo (ID-7 : casse, accents et espaces ignorés, ponctuation comptée), sinon dans le titre des parties où il est inscrit, 250 ms après la dernière frappe. La liste garde ses lignes jusqu'à la réponse. Sans résultat : « Aucun pseudo ne correspond », avec « Effacer la recherche ».
- **Bascule et filtres** (ID-16), au-dessus de la recherche, pour suivre la remise des liens avant la convention : d'abord la bascule « Tous les participants avec un compte » ↔ « Tous les participants », qui affiche le choix à venir et son nombre ; puis un filtre par état du compte, « Compte actif », « En attente », « Lien à créer », « Lien expiré », chacun avec son nombre, un filet gauche de 4 px à la couleur de son état, et le fond teinté une fois choisi (`aria-pressed`). Un second clic efface le filtre d'état, la bascule aussi. Les nombres portent sur les lignes de la recherche. Sans ligne gardée : « Aucun pseudo ne correspond », avec « Effacer le filtre ».
- **Colonnes** : Pseudo, Rôle, Accès au back office, Inscriptions par créneau, Téléphones (nombre de téléphones reliés, rien sur l'appareil).
  - Le pseudo tel qu'il a été saisi, en gras. Trouvé par le titre d'une partie, une seconde ligne en gris : « inscrit à « Brumes » ».
  - Rôle : les badges de la [fiche](#fiche-dun-pseudo), « MJ », « Organisateur », ou « Participant » sans rôle.
  - Accès au back office : l'état du compte, icône et libellé du bandeau de l'onglet Compte, en sa couleur de statut (« En attente · encore 5 jours ») ; rien sans compte.
  - Inscriptions par créneau : un rond par créneau (`app-pip`), comme les disponibilités des MJ, avec le nombre d'inscriptions dedans (de secours comprises, une partie double sur son premier créneau). Contour à la couleur de l'état du créneau, rond teinté s'il y a au moins une inscription, vide avec « 0 » sinon, atténué pour un créneau terminé. Infobulle et texte pour lecteur d'écran : « Créneau 2 · tirage publié : 1 inscription ».
- La liste se tient à jour seule, comme le pilotage (§6, Fraîcheur).
- Le pseudo de chaque ligne mène à sa fiche.
- **« Créer un pseudo »**, action principale de l'en-tête, ouvre l'assistant du même nom (ID-12, ID-16), en dialogue, en trois temps, dont les étapes s'affichent en tête (« 1. Pseudo », « 2. Rôles (facultatif) », « 3. Lien d'accès »), l'étape en cours en gras :
  1. **Pseudo** : le champ « Pseudo » ; Annuler · **Suivant** (ou Entrée). Un pseudo vide ou trop long ne passe pas à l'étape suivante.
  2. **Rôles de « Lune »** : les deux cartes à cocher de l'onglet Compte, MJ et Organisateur, puis en gris « Sans rôle, « Lune » est un simple participant, sans accès au back office. Un rôle se donne aussi plus tard, dans l'onglet « Compte » de sa fiche. » ; Annuler · Retour · **Créer le pseudo**, ou **Créer le pseudo et son compte** avec un rôle.
  3. **Lien d'accès de « Lune »**, avec un rôle seulement : le contenu du dialogue du lien de l'onglet Compte (QR code, « Copier le lien », valable jusqu'au …) ; Voir sa fiche · **Terminé**. « Voir sa fiche » ouvre l'onglet Compte (`?onglet=compte`).

  Sans rôle, le pseudo créé, sa fiche s'ouvre, sans lien. Avec un rôle, une seule requête crée le pseudo, son MJ et son compte, avec le lien. Un pseudo déjà pris, de participant ou de MJ (ID-4, ID-7), ramène à l'étape 1, le refus sous le champ, suivi de « Voir sa fiche », qui ouvre l'onglet Compte du pseudo qui le porte, pour lui donner un rôle au lieu d'un doublon. Sans pseudo, l'état vide invite à « Créer le premier pseudo », qui ouvre l'assistant.

### Fiche d'un pseudo

- **En-tête** : « Participants › pseudo », et dessous ses rôles en badges, icône et libellé : « MJ » (`dices`) en violet, « Organisateur » (`settings`) en turquoise, ou « Participant » (`user-round`) en gris s'il n'a aucun rôle ([jetons.md](jetons.md), couleurs des rôles). Le crayon renomme le pseudo en place, comme sur la [fiche du MJ](#mj), à tout moment (ID-13). Un nom déjà pris par un autre pseudo est refusé sous le champ, suivi de « Voir sa fiche » ; le même refus, avec son lien, vaut sur la fiche du MJ.
- **Menu « ⋯ »** de l'en-tête (« Autres actions sur le pseudo ») : « Couper les liens », seulement si le pseudo a au moins un téléphone. Le geste coupe tous ses liens, sans confirmation ni verrou : le pseudo peut être relié de nouveau (ID-8). Le focus va ensuite à l'onglet Téléphones. Sans entrée, le menu n'apparaît pas.
  Puis, sur la fiche d'un participant, « Fusionner dans un autre pseudo… » (ID-11) ouvre un dialogue « Fusionner « Sven » dans un autre pseudo » : un champ « Chercher la destination », que l'API cherche comme la liste, puis les participants et les MJ trouvés, sauf la source, un bouton radio chacun, « MJ » en gris pour un MJ. La destination choisie, le dialogue lit dans l'API ce que la fusion fera, un paragraphe par fait, créneau par créneau : « Créneau 1 : « Lune » prend sa place à Néons, table Dragon. », « Créneau 1 : sa place à Néons, table Dragon, est perdue. », « Créneau 2 : « Lune » quitte le tirage, pour jouer la partie double du créneau d'avant. », « Créneau 1 : ses inscriptions à Néons et Brumes passent à « Lune ». », « Créneau 2 : son inscription à Dune passe à « Brann », en secours. » (destination MJ qui mène sur le créneau, IN-4), « Créneau 1 : son inscription à Épice est perdue. », « Créneau 2 : « Lune » devient sans partie, et reste dans le tirage. » ; puis « Son téléphone relié reviendra à l'identification. » et « « Sven » sera supprimé, et son pseudo redeviendra libre. ». Annuler · **Fusionner dans « Lune »**, en rouge. Un refus s'affiche dans le dialogue. La fusion faite, la fiche de la destination s'ouvre. Absent de la fiche d'un MJ (PR-12).
  Enfin, sur la fiche d'un participant, « Supprimer le pseudo », en rouge brique, avec une confirmation (ID-10) : « Supprimer le pseudo « Lune » ? », puis ce qui part avec lui (« Ses 2 inscriptions seront supprimées. », « Il sort des tirages, publiés compris : sa partie comptera un joueur de moins, et sa place ne sera proposée à personne. », « Son téléphone relié reviendra à l'identification. »), et « Le pseudo redeviendra libre. ». L'Organisateur revient ensuite à la liste. Absent de la fiche d'un MJ, qui se supprime par sa fiche de MJ (PR-12).
- Quatre [onglets de classeur](#onglets-de-classeur) : **Programme** (`calendar`), **Inscriptions** (`circle-check`), avec ses inscriptions sur les créneaux ouverts, **Téléphones** (`smartphone`), avec leur nombre, et **Compte** (`lock`).
- **Programme** : une frise verticale, un créneau par ligne. Le rond prend la couleur et l'icône de l'état du créneau ([Statuts](#statuts)). Le trait qui relie les ronds est plein pour ce qui est figé (tirage publié, terminé), en pointillés pour ce qui peut encore changer. Puis « Créneau 2 · 14 h 00 – 16 h 30 » et l'état, puis le résultat, en deux lignes, celui d'un tirage provisoire comme celui d'un tirage publié :
  - placé : « Table Dragon », puis « Néons, avec Élodie » ; une partie double sur ses deux créneaux ;
  - non placé : « Non placé » en rouge brique, puis « Il reste de la place à Dragon (3), Licorne (1). », ou « Toutes les parties du créneau sont complètes. » ;
  - MJ : « Mène Néons », puis « Table Dragon » ;
  - créneau tiré sans lui : « Pas dans le tirage » ;
  - créneau ouvert : « 2 inscriptions », ou « Aucune inscription » en gris.
    Au plus un geste par ligne, en secondaire. Sur un créneau ouvert, « ✎ Modifier les inscriptions » ouvre l'onglet Inscriptions sur ce créneau. Sur un tirage provisoire où le pseudo n'est pas, et qu'il ne mène pas, « Rouvrir les inscriptions » (`lock-open`) reprend le geste du pilotage et sa confirmation rouge, mot pour mot, sans nommer le pseudo (TI-6) ; le créneau repasse en inscriptions ouvertes dans la frise. Sur un tirage publié, pas terminé, où le pseudo n'est pas, et qu'il ne mène pas, « + Ajouter comme non placé » (`plus`) ouvre une confirmation orange (principal) : « Ajouter « Sven » au tirage publié du créneau 1 ? », « « Sven » y entre comme non placé : sans prendre la place de personne. », « « Sven » reçoit la notification « pas de place pour toi », avec les tables où il reste de la place. L'ajout ne se défait pas. » ; Annuler · **Ajouter comme non placé** (ID-14). La frise montre alors « Non placé », avec les tables où il reste de la place.
- **Inscriptions** : l'Organisateur inscrit le pseudo à sa place (ID-12), aux règles du téléphone (IN-2 à IN-4, IN-6). Une pilule par créneau ouvert, puis une case par partie qui y commence, enregistrée dès qu'on la coche ou la décoche, sans confirmation (IN-5 ne s'applique pas) ; pendant l'écriture, la ligne est atténuée, et un refus s'ouvre dans le dialogue d'erreur. Sous chaque partie, la [jauge](#jauge) et « 8 inscrits · 4 à 6 places · très demandée », ou « · 1 manquant » en jaune sous le minimum. La partie d'un MJ est grisée, case désactivée, « sa partie » ; sur un créneau où il mène : « Mène « Néons » : ses inscriptions sur ce créneau sont de secours. » Sans partie sur le créneau : « Sans partie sur ce créneau. », en rouge brique, avec « Retirer du tirage ». Sans créneau ouvert : « Aucun créneau n'a ses inscriptions ouvertes. »
- **Téléphones** : « Relié à 9 h 12 », un par ligne, rien sur l'appareil. Sans téléphone : « Aucun téléphone relié : la personne lit ses résultats à l'accueil. »
- **Compte** (ID-16) : un bandeau d'état, tel que l'API le dit, avec un filet gauche de 4 px et un fond à 14 % de la couleur de statut, son icône, une phrase d'aide et son action à droite (secondaire) :
  - « Compte actif » (`circle-check`, vert) : « Le mot de passe est choisi : la personne se connecte seule. » ; « Créer un nouveau lien » ;
  - « En attente · encore 5 jours » (`hourglass`, orange), le temps qui reste au lien : en jours entiers, puis « encore 3 h » le dernier jour, et « encore moins d'une heure » la dernière heure : « Le lien d'accès est créé, la personne ne l'a pas encore suivi. » ; « Créer un nouveau lien » ;
  - « Lien à créer » (`triangle-alert`, jaune) : « Le compte existe, mais aucun lien d'accès n'a été remis. » ; « Créer le lien d'accès » ;
  - « Lien expiré le dimanche 21 mars à 9 h 30 » (`octagon-alert`, rouge brique) : « Le lien n'a pas été suivi à temps : crée-en un nouveau. » ; « Créer un nouveau lien ».

  Sans compte, en gris, « Pas de compte : participant seulement. Donne-lui un rôle pour lui créer un compte. ».
  - **Créer un lien d'accès** (ID-6, ADR 0018) remet le compte à zéro. Sur un compte actif, une confirmation rouge : « Créer un nouveau lien d'accès pour « Lune » ? », « Son mot de passe est effacé tout de suite, et ses sessions ouvertes sont fermées. « Lune » en choisira un nouveau par le lien. » ; Annuler · **Créer le lien**. Sur un lien en attente, la même confirmation, orange : « Le lien déjà créé ne marchera plus. ». Sans lien, ou sur un lien expiré, sans confirmation.
  - Le lien créé s'ouvre dans un dialogue « Lien d'accès de « Lune » » : « Remets ce lien à « Lune », de vive voix ou par message. Il ouvre la page où choisir son mot de passe. », le QR code (`app-qr-code`), l'URL en champ en lecture seule, « Copier le lien » (secondaire, « Lien copié » ensuite), « Valable jusqu'au dimanche 21 mars à 9 h 30, une seule fois. Créer un autre lien annule celui-ci. », puis un avertissement (`triangle-alert`, jaune) : « Attention : ce lien ne s'affichera plus une fois cette fenêtre fermée. », et en gris « Copie-le ou fais scanner le QR code maintenant. Sinon, il faudra créer un nouveau lien, qui annulera celui-ci. » ; **Fermer**. L'URL ne se montre qu'une fois : l'API ne la redonne pas.

  Puis « Rôles dans le back office » : deux cartes à cocher, **MJ** (`dices`, « Saisit ses scénarios et ses disponibilités. ») et **Organisateur** (`settings`, « Tous les droits du back office. »). Cochée, une carte prend la couleur de son rôle : fond à 14 %, bordure à 45 %. La case ne change qu'avec la fiche relue.
  - Donner le rôle MJ se fait sans confirmation, et l'annonce « « Lune » est maintenant MJ. ». Donner le rôle d'Organisateur ouvre une confirmation orange : « Faire de « Lune » un Organisateur ? », « « Lune » aura tous les droits du back office. » ; Annuler · **Rendre Organisateur**. Un premier rôle crée le compte.
  - Retirer un rôle ouvre une confirmation rouge : « Retirer le rôle MJ à « Lune » ? » (ou « le rôle d'Organisateur »), puis ce qui part : « Ses disponibilités seront supprimées. » pour le rôle MJ ; avec le dernier rôle, « Sans autre rôle, son compte sera supprimé, avec son mot de passe, son lien d'accès et ses sessions. « Lune » reste un participant, avec ses inscriptions et ses téléphones. » ; à un Organisateur qui reste MJ, « « Lune » reste MJ : son compte ne donnera plus accès qu'à sa fiche et aux scénarios de la convention. ». Un MJ qui a un scénario garde son rôle : le refus s'affiche dans le dialogue (PR-12).
  - Sur son propre pseudo, la carte Organisateur est désactivée : « Tu ne peux pas te retirer ce rôle : un autre Organisateur peut le faire. ».

## Informations de connexion

La page « Informations de connexion » (`/informations-de-connexion`) donne tout ce qu'il faut pour entrer dans le front office (ID-15). L'Organisateur la montre telle quelle sur un écran de l'accueil, rail compris.

- **En paysage**, sous l'en-tête : à gauche, le QR code sur une tuile `--paper`, modules en `--ink`, d'environ 80 % de la hauteur disponible (sans dépasser 55 % de la largeur, pour laisser sa place au texte) ; à droite, le nom de la convention, les trois étapes numérotées, et l'encadré « Tu n'arrives pas à lire le QR code ? », avec « Va sur **domaine** et tape le code » et le code de présence en grand.
- **Lue de loin** : c'est la seule page dont le texte suit la hauteur de l'écran (en `cqh`), avec la taille de l'échelle comme plancher. Le nom de la convention y prend Uncial Antiqua en orange, comme sur l'affiche (variante B du prototype #152). Ce sont des écarts voulus à l'échelle de [jetons.md](jetons.md).
- Le QR code ouvre le front office du domaine du back office, avec le code de présence (`buildFrontOfficeUrl` de `contract`). Il a un nom accessible.
- Sous le code de présence de « Créneaux et tables », un lien mène à la page.
- **« Imprimer l'affiche »** (principal, dans l'en-tête) ouvre la fenêtre d'impression. La page s'imprime en une **affiche** A4 portrait, d'une seule feuille (variante B du prototype #152), en tailles fixes (mm) :
  - fond `--paper`, texte `--ink`, sans filet en haut : la marge de l'imprimante le couperait ;
  - le nom de la convention en Uncial Antiqua, puis le sous-titre « Regarde le programme, inscris-toi, et sois notifié des informations importantes de cette journée », absent de l'écran ;
  - le QR code centré, dont le symbole mesure 12 cm, sous les 13 cm de #151, pour laisser leur place aux étapes et à un nom de convention sur deux lignes, marge en plus (`--qr-symbol-share`, posé par `app-qr-code`) ;
  - l'encadré du code, puis les trois étapes sur trois colonnes, chacune sous un gros chiffre orange.
- À l'impression, la coquille masque le rail et la région `aria-live`, et la page masque son en-tête.

## Onglets de classeur

Des vues d'un même objet, l'une à la fois, sous ce qui les résume (le résumé d'un créneau).

- Chaque onglet a une **icône**, un **libellé** et un **compteur**.
- L'onglet choisi est **soudé à un panneau encadré**, et marqué d'un **trait orange** en haut. Les autres restent en texte discret.
- Comportement de tablist par Angular Aria : ← →, Début et Fin changent d'onglet.
- **Aucun avertissement sur un onglet** : les avertissements restent dans le résumé, et un onglet reste une commande.
- L'onglet ouvert est **gardé** quand l'objet résumé change (d'un créneau à l'autre).
- Le pilotage et la fiche d'un pseudo partagent leur dessin, écrit une fois dans `styles.css` : un `.binder` qui porte `ngTabs`, et des panneaux `.panel`.

## Jauge

Le dessin d'un nombre face à des places, pour un créneau (demande face à la capacité) comme pour une partie (inscrits face à ses places).

- Des **cases** bout à bout, qui se comptent : une case par personne, inscrit d'une partie comme participant d'un créneau.
- Les cases du minimum au maximum sont **claires**, un **trait** marque chaque borne, et le **remplissage** va jusqu'au nombre, au plus le maximum.
- Au-delà du maximum, les cases sont **hachurées** : rouges pour un créneau, neutres pour une partie très demandée.
- **Remplissage jaune** pour une partie sous son minimum, ou pour un créneau qui porte `nearly-full` ou `too-many-games`. Les couleurs viennent des drapeaux et des codes reçus, jamais d'un nouveau calcul.
- Chaque jauge a **sa propre échelle** : le maximum, ou le nombre s'il le dépasse. Deux jauges voisines se comparent par leurs cases et leurs chiffres, pas par leur longueur.
- L'**écart** d'une partie s'écrit à côté de ses chiffres : « 15 inscrits · 3 à 4 places · 11 de trop », ou « · 1 manquant » sous son minimum (en jaune). L'API le calcule.
- Elle est **décorative** (`aria-hidden`) : les chiffres sont toujours écrits à côté.
