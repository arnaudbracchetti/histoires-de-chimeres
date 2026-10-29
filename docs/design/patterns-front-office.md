# Patterns du front office

Le front office se conçoit pour un téléphone, en portrait. Sur un écran plus large, le contenu garde sa largeur maximale et se centre. Sur place, seul le réseau 4G/5G est disponible : les pages restent légères.

Les règles communes aux deux fronts (focus, statuts, « Une erreur ne décale rien », vocabulaire des boutons) sont dans [patterns.md](patterns.md), qui dit ce qui vaut partout et ce qui est propre au back office. Cette page n'en reprend que ce qui change sur le téléphone.

Écrans de référence : les prototypes des branches `prototype/parcours-d-accueil` ([#50](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/50), variante B), `prototype/coquille-front-office` ([#51](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/51), variante A), `prototype/fiche-de-partie` ([#63](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/63), variante A) et `prototype/vue-du-mj` ([#54](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/54), variante B). En cas d'écart, les écrans livrés et le [PRD](../prd.md) l'emportent.

## Mesures

| Mesure | Valeur | Jeton |
|---|---|---|
| Taille de base du texte | 15 px | `--font-size-mobile-body` |
| Texte d'un champ | 17 px, jamais moins de 16 px : sinon Safari zoome à la saisie | `--font-size-mobile-field` |
| Plus petite cible tactile | 44 × 44 px | `--touch-target` |
| Hauteur d'un bouton | 48 px | `--button-height` |
| Hauteur d'un champ | 52 px | `--field-height` |
| En-tête, barre d'onglets | 56 px | `--bar-height` |
| Gouttière, à gauche et à droite de l'écran | 16 px | `--gutter` |
| Largeur maximale du contenu | 480 px | `--content-width` |
| Boîte du pseudo | 264 px de large | `--popover-width` |
| Écart entre un élément et ce qu'il ouvre | 8 px | `--overlay-offset` |

L'échelle typographique du mobile est dans [jetons.md](jetons.md#échelle-typographique-front-office).

- Les décalages du CDK (position d'une boîte, largeur d'un dialogue) s'écrivent en CSS, par ces jetons, jamais en TypeScript.

## Coquille

Une fois le téléphone relié à un pseudo, chaque écran vit dans la coquille.

- **En-tête**, collant en haut : l'emblème (28 px), « Histoires de Chimères » en Uncial Antiqua, à la taille du texte, coupé par des points de suspension s'il manque de place, puis le **bouton du pseudo**.
- **Bouton du pseudo** : une pilule en Anthracite 3, l'icône `user-round` et le pseudo, coupé au-delà de 150 px. Ouvert, il passe en orange (`aria-expanded`).
- **Barre d'onglets**, collante en bas : Accueil (`house`), Programme (`calendar`), Mes parties (`dices`). Chaque onglet est un lien, icône au-dessus du libellé ; l'onglet courant est en orange et porte `aria-current="page"`.
- **Contenu** entre les deux, dans la gouttière, à la largeur maximale.
- Pas d'onglet propre au MJ : sa partie menée se déplie dans Mes parties ([#54](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/54)).

### Historique

Le retour du téléphone remonte toujours d'un écran.

- **L'Accueil est la racine.** Le retour depuis l'Accueil quitte l'application.
- **Un onglet ne s'empile pas.** Depuis l'Accueil, un onglet se pose dessus ; depuis un autre onglet, il le remplace. Toucher l'onglet Accueil revient en arrière plutôt que d'empiler l'Accueil.
- **Une fiche s'empile** sur l'écran qui l'ouvre : fiche → liste → Accueil → sortie.
- **Une application ouverte ailleurs que sur l'Accueil** (lien d'une notification) recrée l'Accueil dessous, pour que le retour y mène.

### Boîte du pseudo

Un tap sur le bouton du pseudo ouvre une boîte sous lui, calée sur son bord droit, avec une pointe vers lui.

- Dialogue du CDK, nommé « Ton pseudo », sur le fond assombri (`.scrim`) : un tap à côté ou Échap la ferme, et le focus revient au bouton.
- Contenu : le surtitre « Ton pseudo », le pseudo en entier (taille de section, coupé où il faut), puis « Changer de pseudo » (principal).
- « Changer de pseudo » ferme la boîte et ouvre sa confirmation (ID-9, voir [Dialogue de confirmation](#dialogue-de-confirmation)).

## Parcours d'identification

Avant d'être relié à un pseudo, le téléphone passe par l'identification (ID-1, ID-2) : « Code de présence » s'il manque, puis « Ton pseudo », et « Ce pseudo existe déjà » pour un pseudo pris. « La convention est terminée » remplace tout après la fin du dernier créneau.

- **Pas de coquille** : ni en-tête, ni onglets. Le motif gravé est en **filigrane**, centré et fixe ; le contenu est centré sur lui, verticalement comme horizontalement, et son texte aussi.
- Un écran porte un titre (h1, Uncial Antiqua), quelques phrases courtes, puis son champ ou ses boutons.
- **Une étape qui en suit une autre a son propre retour** : un bouton ‹ (`chevron-left`, « Retour ») en haut à gauche, hors du contenu centré. Le geste de retour du téléphone n'y suffit pas : la web app de l'iPhone n'en a pas. Revenir rend l'étape précédente avec ce qui y était tapé, focus sur son champ. « Ce pseudo existe déjà » revient ainsi à « Ton pseudo ». « Ton pseudo » n'a pas de retour : un code de présence accepté ne se redemande pas.
- **Le pseudo d'un autre** (« Ce pseudo existe déjà ») s'affiche en grand au-dessus du titre, en Uncial Antiqua orange (`--font-size-mobile-hero`, interligne `--line-height-display`).
- Deux choix s'empilent sur toute la largeur, le principal au-dessus : « Oui, c'est moi », puis « Non, choisir un autre pseudo ».

## Champs et validation

Le composant `app-field` et les règles de validation sont ceux du back office ([patterns.md](patterns.md#champs)). Sur le téléphone :

- le champ prend toute la largeur, en 52 px de haut, texte à 17 px ;
- le libellé, semi-gras, est au-dessus ; l'aide puis l'erreur, à 13 px, dessous ;
- **deux lignes réservées pour l'erreur** : un refus de l'API tient sur deux lignes à la largeur d'un téléphone ;
- le clavier se règle par le champ : `enterkeyhint="go"` pour un champ seul, `autocapitalize` selon ce qu'on tape (`words` pour un pseudo, `characters` pour un code), `spellcheck="false"` et `autocomplete="off"` pour un pseudo ou un code ;
- le code de présence s'écrit en Aldrich, à taille de section, espacé et centré ;
- Entrée envoie le formulaire, comme le bouton.

**Une erreur ne décale rien**, ici comme partout : le bouton sous le champ reste à sa place quand l'erreur apparaît. Un test Playwright du projet `mobile` le vérifie sur « Ton pseudo ».

## Boutons

Les dessins sont ceux du back office ([patterns.md](patterns.md#boutons)), à la taille du pouce :

| Bouton | Dessin | Usage |
|---|---|---|
| **Principal** | orange plein, texte charbon, 48 px | l'action de l'écran, une seule par vue |
| **Secondaire** | Anthracite 3 et filet, texte clair, 48 px | l'autre choix, et « Annuler » dans un dialogue |
| **Discret** | texte orange seul, 48 px | action de moindre poids |
| **Icône seule** | rond de 44 px, icône en texte secondaire | ✕ d'une alerte, ‹ d'un retour ; nom accessible et infobulle |

- Dans un formulaire ou un dialogue, le bouton d'envoi ou la paire de choix prend **toute la largeur** du contenu, l'un sous l'autre : côte à côte, deux boutons ne tiennent pas un libellé long. Dans une carte, un bouton garde la largeur de son libellé (« Voir le programme »).
- Un lien qui mène à un écran (« Voir le programme ») peut avoir l'allure d'un bouton (`<a appButton>`).
- Pendant l'envoi, le libellé dit ce qui se passe (« Vérification… », « Changement… ») et un second tap est sans effet.

## Alertes

Une erreur hors formulaire (coupure réseau, refus sans champ, 500) s'affiche en alerte, comme dans le back office ([patterns.md](patterns.md#erreur-hors-formulaire)), mais **en bas de l'écran**, sous le pouce :

- fixée en bas, dans la gouttière, à la largeur du contenu, au-dessus de tout ;
- bordée de rouge brique, en Anthracite 2 : le `title` en gras, le `detail` dessous en texte secondaire, et ✕ à droite ;
- elle reste jusqu'à ce qu'on la ferme ; trois au plus, la plus ancienne part au-delà.

## Dialogue de confirmation

Une confirmation (« Changer de pseudo ? ») suit les règles du back office ([patterns.md](patterns.md#actions-destructrices)) : une question qui nomme l'objet, ce qui part avec lui, un refus de l'API affiché dans le dialogue lui-même.

- `role="alertdialog"`, sur le fond assombri, **centré**, à la largeur du contenu dans la gouttière.
- Anthracite 3, bordé d'un filet, rayon de carte. La question en police système, semi-gras, à taille de section.
- Les deux boutons s'empilent sur toute la largeur : l'action au-dessus, « Annuler » (secondaire) dessous.
- Le focus initial est sur « Annuler » ; à la fermeture, il revient à ce qui a ouvert le dialogue.
- L'action n'est pas destructrice au sens du back office : elle reste en bouton principal. Le rouge plein reste réservé à une suppression.

## À venir avec leurs écrans

Ces patterns ont été tranchés sur prototype, mais pas encore construits. Chacun se décrit ici avec son premier écran.

- **Bandeau de NO-6** : sous l'en-tête, sur chaque écran tant que le téléphone ne reçoit pas les notifications. Il ne se ferme pas ; un tap ouvre le guide d'activation.
- **Ligne d'âge** (PRD §6, Fraîcheur) : sous l'en-tête, quand la donnée a plus de 2 minutes : « Pas de connexion · à jour à 14 h 05 ». Un tap relance la lecture.
- **Alerte de changement** (NO-5) : ce qui change pour le participant sans geste de sa part, en bas de l'écran, avec « Voir ».
- **Barre d'action de la fiche** (#63, variante A) : le geste d'inscription, fixé en bas de la fiche d'une partie.
- **Dialogue en bas de l'écran** : la confirmation d'une inscription à une partie très demandée (IN-5), qui monte du bas.
- **Bloc de la partie menée** (#54, variante B) : dans Mes parties, sur son créneau, la partie qu'un MJ mène, ses inscrits puis ses joueurs.
