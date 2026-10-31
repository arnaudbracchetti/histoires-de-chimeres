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

Avant d'être relié à un pseudo, le téléphone passe par l'identification (ID-1, ID-2) : « Code de présence » s'il manque, puis « Ton pseudo », et « Ce pseudo existe déjà » pour un pseudo de participant pris, ou « Es-tu bien ce MJ ? » pour un pseudo de MJ (ID-3). « La convention est terminée » remplace tout après la fin du dernier créneau.

- **Pas de coquille** : ni en-tête, ni onglets. Le motif gravé est en **filigrane**, centré et fixe ; le contenu est centré sur lui, verticalement comme horizontalement, et son texte aussi.
- Un écran porte un titre (h1, Uncial Antiqua), quelques phrases courtes, puis son champ ou ses boutons.
- **Une étape qui en suit une autre a son propre retour** : un bouton ‹ (`chevron-left`, « Retour ») en haut à gauche, hors du contenu centré. Le geste de retour du téléphone n'y suffit pas : la web app de l'iPhone n'en a pas. Revenir rend l'étape précédente avec ce qui y était tapé, focus sur son champ. « Ce pseudo existe déjà » et « Es-tu bien ce MJ ? » reviennent ainsi à « Ton pseudo ». « Ton pseudo » n'a pas de retour : un code de présence accepté ne se redemande pas.
- **Le pseudo d'un autre** (« Ce pseudo existe déjà », « Es-tu bien ce MJ ? ») s'affiche en grand au-dessus du titre, en Uncial Antiqua orange (`--font-size-mobile-hero`, interligne `--line-height-display`).
- Deux choix s'empilent sur toute la largeur, le principal au-dessus : « Oui, c'est moi », puis « Non, choisir un autre pseudo ».
- « Es-tu bien ce MJ ? » dit ce que le lien ouvre (les parties à mener, dans Mes parties, et leurs notifications), puis renvoie vers un Organisateur en cas de doute, comme « Ce pseudo existe déjà ».

## Notifications

Juste après l'identification, un téléphone qui n'a encore ni accordé ni refusé les notifications passe par « Active les notifications » (§4.2). Les autres vont droit à l'Accueil.

- **« Active les notifications »** : écran du parcours (sans coquille), sous le surtitre « Dernière étape ». « C'est par elles que l'application te tient au courant : », puis la liste de ce qu'elles apportent, une icône orange par ligne (`circle-check`, `sparkles`, `triangle-alert`, et `book-open` pour un MJ). Jamais « partie très demandée ». Puis l'exemple, sous le surtitre « Exemple de notification », dans une carte Anthracite 3 avec l'emblème. En texte secondaire : « Ton téléphone va te demander l'autorisation : touche « Autoriser ». » Boutons empilés : « Activer les notifications » (principal, `bell`), puis « Plus tard » (discret). La demande du téléphone ne vient qu'après le tap ; fermée sans réponse, elle laisse l'écran tel quel.
- **« Continuer sans notifications ? »**, ouvert par « Plus tard » : [dialogue de confirmation](#dialogue-de-confirmation) qui redit ce qu'on perd et que le bandeau le rappellera. « Activer les notifications » d'abord, puis « Continuer sans ». Échap ou un tap à côté revient à l'écran.
- **« Notifications bloquées »**, après un refus : ce qu'on perd, le chemin des réglages en étapes numérotées (dans Chrome, l'icône `settings` à gauche de l'adresse, puis « Autorisations » ; dans l'application installée, ses infos `info`, puis « Notifications »), et le repli : revenir voir l'application après chaque tirage. Un seul bouton, « Continuer ».
- Les noms à toucher dans les réglages s'écrivent comme des touches : semi-gras, filet, fond Anthracite 3.

### Bandeau de NO-6

Sous l'en-tête de la coquille, sur chaque onglet, tant que le téléphone ne reçoit pas les notifications. Il ne se ferme pas. Fond jaune teinté à 14 %, texte semi-gras à 13 px.

- Permission pas donnée ou refusée : un bouton sur toute la largeur, `bell-off` en jaune, le texte de NO-6, `chevron-right` à droite. Un tap ouvre le **guide d'activation**, une feuille qui monte du bas : « Active les notifications » (la liste et le bouton) ou « Notifications bloquées » (le chemin des réglages), et « Fermer ».
- Téléphone qui ne peut pas les recevoir (navigateur sans Push API, ou serveur sans clés VAPID) : un simple texte (`role="status"`), `triangle-alert` en jaune, sans tap.
- Une permission réactivée dans les réglages se voit au retour au premier plan : le bandeau disparaît.

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

## Barre d'action de la fiche

La fiche d'une partie n'a pas de filigrane : son fond est plein, pour que le texte se lise bien.

Le geste d'inscription (IN-2), fixé en bas de la fiche d'une partie, toujours sous le pouce ([#63](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/63), variante A).

- Collée en bas de l'écran, en Anthracite 1, sous un filet ; le contenu à la largeur maximale, dans la gouttière.
- **Inscriptions ouvertes** : « S'inscrire » (principal, icône `plus`), sur toute la largeur. Une fois inscrit, sur une ligne : « Inscription enregistrée » (`circle-check` orange), puis « Se désinscrire » (secondaire), qui retire l'inscription d'un tap, sans confirmation.
- **Pendant l'envoi**, le libellé devient « Inscription… » ou « Désinscription… », et un second tap est sans effet. Le bouton reste actif sans réseau : l'échec se dit en alerte (« Pas de connexion : rien n'a été enregistré. »), et après 10 s sans réponse, « Le réseau ne répond pas : vérifie ton inscription. ». Les données sont relues après chaque geste, réussi ou non.
- **Geste impossible** : à la place du bouton, un statut (icône, titre en gras, phrase en texte secondaire) dit pourquoi : « Tirage en cours », « Tu joues aux créneaux 3 et 4 », « Tu joues à cette table », « Pas de place pour toi », « Tirage publié ». Quand le pseudo joue à une autre table, « Voir ta partie » (secondaire) ouvre sa fiche.
- **MJ** (IN-4, §5.7), avec `book-open` orange : sur sa propre partie, « Tu mènes cette partie » et « Voir dans Mes parties » (secondaire), qui ouvre Mes parties sur son créneau ; sur une autre partie d'un créneau où il mène, partie double comprise, « Tu mènes une partie sur ce créneau » avec le titre et la table de sa partie.
- La barre annonce ses changements (`aria-live="polite"`).

Sur une carte du programme, un badge « Inscrit » (`check`, orange teinté à 14 %) se pose en haut à gauche de l'image d'une partie où le pseudo est inscrit, et « Tu mènes » (`book-open`) sur celle que mène son MJ.

Pour un MJ, la puce d'un créneau où il mène porte `book-open` devant l'heure. Sous la plage horaire du créneau, une note sur fond orange teinté à 14 % dit pourquoi il ne peut pas s'y inscrire : « Tu mènes *Titre* à la table *T* : tu ne peux pas t'inscrire comme joueur sur ce créneau. »

## Accueil

En tête, une seule carte (stories 54, 55, 57, 59), puis « Ton programme ».

- **Affectation** : la dernière publiée, tant que sa partie n'est pas terminée (une partie double, jusqu'à la fin de son second créneau). Carte 3:2 qui ouvre la fiche : l'image, dans son coin « Début à 9 h 30 » ou « Maintenant » (`clock`, orange teinté à 14 %), puis par-dessus « Créneau 1 · 9 h 30 – 12 h 00 » en surtitre, « Table Griffon » en Uncial Antiqua à taille de héros, « Tu joues à *Titre*, avec *MJ* » et le jeu.
- **« Pas de place pour toi »**, si c'est le dernier résultat publié : carte bordée de jaune, la phrase qui dit où il reste de la place, puis une carte par partie du créneau qui en a (vignette, « Table Dragon », « *Titre*, avec *MJ* », « 2 places libres » en vert), qui ouvre sa fiche.
- **MJ** (stories 56, 58) : si le dernier résultat publié est celui de sa partie, la même carte 3:2, qui ouvre Mes parties, avec « Tu mènes à la table *T* » et « *Titre*, avec *K* joueurs. », puis « Voir tes joueurs » (secondaire, `users`) ; sa partie annulée, « Ta partie est annulée » comme « Pas de place pour toi ». Pendant le tirage de son créneau, « Tirage en cours » avec « Tu mènes *Titre* à la table *T* : *K* inscrits pour *M* places. » et « Voir ta partie » (secondaire, `book-open`).
- **« Tirage en cours »**, sinon, pour un créneau en cours de tirage où le pseudo est inscrit : ses inscriptions comptent pour ce tirage, et sa table s'affichera ici dès la publication.
- **« Choisis tes parties »**, sans rien de tout cela, avec « Voir le programme ».

**Ton programme** : une liste en Anthracite 2, une ligne par créneau à venir, sauf ceux de la carte. Le surtitre « Créneau 2 · 14 h 00 », puis l'état du pseudo (icône, libellé semi-gras, détail en texte secondaire), et `chevron-right` à droite :

| État | Icône | Libellé · détail |
|---|---|---|
| inscriptions ouvertes | `circle-check` orange, ou `plus` | « 2 inscriptions » · leurs titres, ou « Aucune inscription » · « Choisir une partie » |
| tirage en cours | `hourglass` | « Tirage en cours » · ses inscriptions |
| table | `circle-check` vert | « Table Griffon » · « *Titre*, avec *MJ* » |
| pas de place | `triangle-alert` jaune | « Pas de place pour toi » · les tables où il en reste |
| publié, sans inscription | `circle-check` | « Tirage publié » · « Aucune inscription sur ce créneau » |
| MJ qui y mène | `book-open` orange | « Tu mènes à la table Dragon » · « *Titre* · 7 inscrits · 5 places », « · tirage en cours » ou « , avec 5 joueurs » |
| sa partie annulée | `triangle-alert` jaune | « Ta partie est annulée » · les tables où il reste de la place |

Une ligne ouvre la fiche de sa table, Mes parties sur un créneau où il mène, sinon le programme du créneau, posé sur l'Accueil comme son onglet. Le rappel d'IN-5 s'y ajoute, sur fond jaune teinté à 14 %.

## Mes parties

L'onglet suit la journée du pseudo, créneau par créneau à venir (story 86). Chaque créneau est une section titrée « Créneau 2 », suivie de sa plage horaire en texte secondaire.

- **Rappel « partie très demandée »** (IN-5) : en tête du créneau, sur fond jaune teinté à 14 %, avec `triangle-alert` en jaune : « Ta seule inscription du créneau 2 est une partie très demandée : inscris-toi aussi à une autre partie. » Il disparaît dès le lancement du tirage.
- **Inscriptions** : une carte par partie, en Anthracite 3 sous un filet, qui ouvre sa fiche. À gauche, le titre, la table (et « créneaux 3 et 4 » pour une partie double, listée sous son seul premier créneau), puis « Très demandée » s'il y a lieu ; à droite, la vignette de 44 px du scénario. Sans inscription : « Aucune inscription sur ce créneau. », en texte secondaire.
- **Affectation**, après la publication, sous les inscriptions : une carte qui ouvre la fiche, avec `circle-check` en vert, le surtitre « Table Griffon » et « Tu joues à *Titre*, avec *MJ* ». Non placé : « Pas de place pour toi », avec `triangle-alert` en jaune.
- **Partie menée** (§5.7, [#54](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/54), variante B) : sur chaque créneau où le MJ mène, les deux d'une partie double, à la place des inscriptions. Carte en Anthracite 2, bordée d'orange : la vignette de 48 px, « Tu mènes » en surtitre, « Table Dragon », le titre en lien orange vers la fiche, le jeu ; puis « Début à 14 h 00 » ou « Maintenant » (`clock`, orange). Selon le tirage de son premier créneau :
  - inscriptions ouvertes : « 7 inscrits · 4 à 5 places », « Très demandée » s'il y a lieu, sans les pseudos, puis « Tes joueurs s'afficheront ici à la publication du tirage. » ;
  - tirage lancé : « Tirage en cours » (`hourglass`), et le nombre d'inscrits pour les places ; le résultat provisoire reste invisible ;
  - publié : « Tes 5 joueurs · 4 à 5 places » en surtitre, puis un pseudo par ligne, après son initiale dans un rond orange teinté, dans l'ordre que donne l'API ;
  - annulée (TI-6) : « Partie annulée » (`triangle-alert` jaune), la phrase de NO-2, puis les parties du créneau où il reste de la place, comme sur l'Accueil.

`/mes-parties?creneau=2` fait défiler jusqu'au créneau 2 : « Voir tes joueurs » et « Voir dans Mes parties » y mènent.

## À venir avec leurs écrans

Ces patterns ont été tranchés sur prototype, mais pas encore construits. Chacun se décrit ici avec son premier écran.

- **Ligne d'âge** (PRD §6, Fraîcheur) : sous l'en-tête, quand la donnée a plus de 2 minutes : « Pas de connexion · à jour à 14 h 05 ». Un tap relance la lecture.
- **Alerte de changement** (NO-5) : ce qui change pour le participant sans geste de sa part, en bas de l'écran, avec « Voir ».
- **Dialogue en bas de l'écran** : la confirmation d'une inscription à une partie très demandée (IN-5), qui monte du bas.
