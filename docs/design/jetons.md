# Jetons

Un seul thème, sombre. Les jetons sont des **jetons de rôle** en anglais, posés sur `:root`, dans `@layer tokens`, par [`packages/design/tokens.css`](../../packages/design/tokens.css). **Les valeurs y font foi** : cette page ne garde que les rôles, les contrastes et la correspondance avec les noms de la charte. Il n'y a pas de couche de palette brute : un composant n'utilise jamais une couleur en dur, et le SVG référence les jetons. Les noms français sont ceux de la charte et des échanges.

## Couleurs

| Charte | Jeton CSS | Rôle |
|---|---|---|
| Charbon | `--surface-0` | fond de page |
| Anthracite 1 | `--surface-1` | panneaux, rail, en-tête, fiche latérale |
| Anthracite 2 | `--surface-2` | cartes, parties, dialogues |
| Anthracite 3 | `--surface-3` | champs, puces, survol |
| Filet | `--border` | bordures de 1 px |
| Texte | `--text` | texte courant |
| Texte secondaire | `--text-muted` | métadonnées, heures, aide |
| Orange | `--accent` | action principale, liens, élément actif, halo |
| Texte sur orange | `--on-accent` | libellé du bouton principal |
| Focus | `--focus` | anneau de focus, et rien d'autre |
| Vert | `--success` | statut correct, complet |
| Jaune | `--warning` | statut attention |
| Rouge brique | `--danger` | statut surcharge, erreur, entrée de menu destructrice |
| Rouge (bouton) | `--danger-fill` | fond du bouton destructeur, libellé en `--text` |
| Gravure | `--engraving` | motif gravé complet |
| Gravure relevée | `--engraving-strong` | motif gravé simplifié des vignettes |
| Lettrine | `--initial` | lettrine de l'illustration par défaut |
| Gris de l'emblème | `--emblem-1` à `--emblem-6` | segments gris de l'anneau de l'emblème, du plus sombre au plus clair |

- **L'orange est le même d'une édition à l'autre.** Relevé sur une vignette JPEG de l'affiche (l'aplat du texte orange), il est à confirmer sur le fichier source si on l'obtient.
- **Le texte blanc sur orange est exclu** (2,27:1) : le bouton principal porte un texte charbon.
- **Le charbon est neutre, légèrement froid**, comme le fond relevé sur l'affiche.
- **Le bleu du focus ne sert qu'au focus**, pour ne jamais se confondre avec l'orange des actions. Il n'y a pas de bleu « information ».
- **Fond d'un badge de statut** : la couleur du statut à 14 % sur Anthracite 2, `color-mix(in srgb, var(--success) 14%, var(--surface-2))`.

## Contrastes vérifiés

| Couple | Contraste |
|---|---|
| Texte sur Charbon | 14,98:1 |
| Texte sur Anthracite 3 | 11,56:1 |
| Texte secondaire sur Charbon | 7,28:1 |
| Texte secondaire sur Anthracite 2 | 6,25:1 |
| Texte secondaire sur Anthracite 3 | 5,62:1 |
| Orange sur Charbon | 7,93:1 |
| Orange sur Anthracite 2 | 6,81:1 |
| Orange sur Anthracite 3 | 6,12:1 |
| Texte sur orange, sur Orange | 7,85:1 |
| Texte sur Rouge (bouton) | 4,96:1 |
| Rouge brique sur Anthracite 3 | 5,24:1 |
| Vert sur son badge | 5,36:1 |
| Jaune sur son badge | 7,23:1 |
| Rouge brique sur son badge | 4,64:1 |
| Focus sur Charbon | 9,32:1 |
| Focus sur Anthracite 2 | 8,00:1 |
| Lettrine sur Anthracite 2 | 4,16:1 (décor) |
| Lettrine sur Anthracite 3 | 3,74:1 (décor) |
| Gravure relevée sur Anthracite 3 | 2,42:1 (décor) |

Un nouveau couple texte et fond se vérifie avant d'entrer dans un composant : 4,5:1 pour le texte, 3:1 pour un composant ou une bordure qui porte du sens. Les décors (gravure, lettrine) n'ont pas d'exigence.

## Polices

| Rôle | Police | Jeton |
|---|---|---|
| Nom de l'application, titre de page (h1) | **Uncial Antiqua**, une seule graisse | `--font-display` |
| Capitales espacées : surtitres, en-têtes de créneau et de table | **Aldrich**, une seule graisse, en Regular | `--font-caps` |
| Tout le reste | police système (`system-ui`) | `--font-ui` |

- Uncial Antiqua et Aldrich sont sous SIL Open Font License et ont tous les accents français. Elles sont livrées en WOFF2, en sous-ensemble latin étendu, en `font-display: swap`, avec leurs licences. Elles sont hébergées avec l'application, jamais chargées depuis Google Fonts, et marchent hors ligne.
- **Pas de gras simulé** : ni Uncial Antiqua ni Aldrich n'ont de gras.
- **Chiffres à chasse fixe** (`font-variant-numeric: tabular-nums`) pour les heures, les compteurs, les places et les ratios.
- Écartées : Deutsche Uncialis, la police de l'affiche (licence qui interdit sous-ensemble et police web), Martel, Saira, Chakra Petch, Exo 2, Victoria Tech et Pink Sans.

## Échelle typographique (back office)

La taille de base du back office est de 13 px (`--font-size-body`), posée dans son `styles.css`. Celle du front office se fixera avec ses patterns. Les tailles sont en `rem`.

| Rôle | Police | Jeton |
|---|---|---|
| Titre de page (h1) | Uncial Antiqua | `--font-size-title` |
| Titre de section (h2) | système, semi-gras | `--font-size-section` |
| Titre de carte ou de bloc (h3) | système, semi-gras | `--font-size-block` |
| Texte courant | système | `--font-size-body` |
| Métadonnées, aide, compteurs | système | `--font-size-meta` |
| Surtitres, en-têtes de créneau et de table | Aldrich, capitales, `letter-spacing: 0.12em` | `--font-size-overline` |

- Interligne de 1,4 pour le texte, de 1,2 pour les titres.
- Aucune autre taille : les prototypes en ont essayé d'intermédiaires, l'échelle les ferme.

## Espacements

De `--space-xxs` à `--space-xxl` (`xxs`, `xs`, `s`, `m`, `l`, `xl`, `xxl`). Aucune autre valeur. La marge intérieure courante d'un bloc du back office est `--space-s`.

## Rayons

| Jeton | Pour |
|---|---|
| `--radius-card` | cartes, parties, dialogues, fiche latérale |
| `--radius-control` | boutons, champs, menus, alertes |
| `--radius-thumb` | vignettes |

Pastilles et badges sont en pilule (`999px`).

## Profondeur et halo

- **Pas d'ombres grises.** La profondeur vient des paliers de surface et des filets.
- **Halo** (`--halo`) : un contour orange plus un flou orange léger. Il est réservé à l'élément saisi pendant un glisser-déposer et à une cible valide.
- **Halo discret** (`--halo-soft`) : un contour orange atténué, pour le survol d'une partie.
- Le halo ne remplace jamais l'anneau de focus, qui reste bleu.

## Densité du calendrier

Environ 0,8 px par minute dans la frise, soit 120 px pour un créneau de 2 h 30.

## Mouvement

- Micro-animations de moins de 200 ms : apparition d'un menu, retour d'une partie refusée à sa place, ouverture de la fiche latérale.
- Toutes désactivées sous `prefers-reduced-motion: reduce`.
