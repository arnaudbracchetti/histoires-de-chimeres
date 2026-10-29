# Écriture du CSS et des composants

Le choix et ses raisons sont dans l'[ADR 0006](../adr/0006-interface-sans-bibliotheque-de-composants.md). Cette page en donne les conventions d'écriture.

## Le package `@chimeres/design`

`packages/design`, sans framework, ne dépend de rien. Les deux fronts en dépendent, avec `contract`.

| Contenu | Détail |
|---|---|
| `tokens.css` | les jetons de rôle de [jetons.md](jetons.md), sur `:root`, dans `@layer tokens` |
| `fonts.css`, `fonts/` | Uncial Antiqua et Aldrich en WOFF2, sous-ensemble latin étendu, `@font-face` en `font-display: swap`, licences OFL livrées. Le build de chaque front copie les fichiers dans sa sortie (`media/`, nom haché) ; le service worker du front office les précharge |
| `svg/illustration.svg` | sprite du motif gravé : complet (`engraving`), complet sans spirale pour la lettrine (`engraving-initial`), simplifié (`engraving-small`) |
| `svg/icons.svg` | sprite des icônes Lucide (licence ISC), copiées à mesure qu'on s'en sert, colorées par `currentColor` |
| `svg/emblem.svg` | l'emblème, complet (`emblem`) et ≤ 32 px (`emblem-small`) |
| `pwa/` | les PNG de la PWA et le favicon, tirés une fois de l'emblème et versionnés |
| `initialOf(title)` | la seule logique du package : l'initiale de l'illustration par défaut, testée par Vitest |

Chaque front importe `tokens.css` et `fonts.css` dans son `styles.css`, et copie les sprites à sa racine, les licences dans `licences/` (`assets` de `angular.json`). Le front office copie aussi `pwa/` dans `icons/`.

Aucune couleur n'est écrite en TypeScript ni en dur dans un SVG : le SVG référence les jetons.

## Composants

- Chaque composant d'interface s'écrit à la main : bouton, champ, tableau triable, pastille, badge, alerte, menu, dialogue.
- Comportement et accessibilité viennent du CDK (`drag-drop`, `dialog`, `overlay`, `a11y`) et d'Angular Aria (motif Menu), jamais d'un ARIA réécrit à la main quand un motif existe.
- Les composants qui enveloppent `design` (champ, illustration, icône) sont **minces et dupliqués dans chaque front**, comme `api-resource.ts`. Pas de bibliothèque Angular partagée.
- Une icône s'affiche par `<svg><use href="icons.svg#nom"/></svg>`. Décorative, elle porte `aria-hidden="true"` ; seule dans un bouton, c'est le bouton qui porte le nom accessible.
- Formulaires : Signal Forms, `[formField]` sur des contrôles natifs. Un formulaire s'envoie par `submitWith()` (`forms/`), et une carte en saisie ajoute la directive `CardForm` par `hostDirectives`.
- Tableaux (back office, `ui/`) : chaque liste garde son `<table>` et ses cellules. Le reste vient de quatre briques :
  - `tableView()` : le filtre (sans casse ni accent) et le tri (ordre naturel, inversé au second clic), en signaux et sans DOM. La liste lit `view.rows()` ;
  - `th[appSortable]` : l'en-tête triable, avec `aria-sort` et la flèche sur la seule colonne triée ;
  - `app-table-filter` : le champ de filtre lié à `view.filter`, dont `focus()` sert après « Effacer le filtre ». La ligne « Aucun … ne correspond » reste dans la liste, qui seule connaît son `colspan` ;
  - `app-empty-state` : le motif gravé, avec la phrase et l'invitation projetées. Il sert aux listes comme aux pages.

## CSS

- **Natif, sans préprocesseur** : imbrication native, aplatie par esbuild selon la `browserslist`.
- **Couches**, déclarées une fois dans le `styles.css` de chaque front : `@layer reset, tokens, base, components;`. Le back office ajoute `cdk-resets` en tête : le CDK y remet à zéro l'aperçu d'un glisser-déposer, et le style du composant doit l'emporter.
  - `reset` : remise à zéro courte ;
  - `tokens` : l'import de `tokens.css` ;
  - `base` : éléments HTML nus (corps, titres, liens, tableaux, champs), taille de base du front (13 px dans le back office, 15 px dans le front office) ;
  - `components` : les styles des composants.
- **Styles encapsulés** par composant (`ViewEncapsulation.Emulated`), écrits dans `@layer components`. Le `styles.css` global reste court.
- **Unités** :
  - `rem` pour le texte et les tailles qui suivent le texte ;
  - `px` pour les filets, les rayons, les vignettes et les dimensions fixées par la charte (32 et 44 px, 0,8 px par minute) ;
  - les espacements passent par les jetons `--space-*`, jamais par une valeur libre.
- **Seulement des jetons** pour les couleurs, les polices, les tailles de texte, les espacements, les rayons et le halo, et dans le front office pour les interlignes (`--line-height-*`). Le back office garde quelques interlignes propres à ses composants denses ; sa base les prend des jetons. Le front office prend son échelle (`--font-size-mobile-*`) et ses dimensions (`--touch-target`, `--button-height`, `--gutter`, `--content-width`…), jamais celles du back office.
- **Les réglages du CDK passent par le CSS** : la position d'une boîte, l'écart avec son origine, la largeur d'un dialogue s'écrivent dans le style du composant ouvert, par les jetons. Le TypeScript ne donne que l'origine et le sens (`originX`, `overlayY`…), jamais de décalage ni de largeur.
- **Mouvement** : transitions de moins de 200 ms, toutes neutralisées sous `@media (prefers-reduced-motion: reduce)`.
- Pas d'ombre grise, pas de `backdrop-filter`.
