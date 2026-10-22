# Jetons

Un seul thème, sombre. Les jetons sont des **jetons de rôle** en anglais, posés sur `:root` dans `packages/design/tokens.css`. Il n'y a pas de couche de palette brute : un composant n'utilise jamais une couleur en dur, et le SVG référence les jetons. Les noms français sont ceux de la charte et des échanges.

## Couleurs

| Charte | Jeton CSS | Valeur | Rôle |
|---|---|---|---|
| Charbon | `--surface-0` | `#151717` | fond de page |
| Anthracite 1 | `--surface-1` | `#1B1E1E` | panneaux, rail, en-tête, fiche latérale |
| Anthracite 2 | `--surface-2` | `#222525` | cartes, parties, dialogues |
| Anthracite 3 | `--surface-3` | `#2A2D2D` | champs, puces, survol |
| Filet | `--border` | `#313535` | bordures de 1 px |
| Texte | `--text` | `#ECEAE6` | texte courant |
| Texte secondaire | `--text-muted` | `#A9A49E` | métadonnées, heures, aide |
| Orange | `--accent` | `#FC9203` | action principale, liens, élément actif, halo |
| Texte sur orange | `--on-accent` | `#161818` | libellé du bouton principal |
| Focus | `--focus` | `#7CC4E4` | anneau de focus, et rien d'autre |
| Vert | `--success` | `#6CC08B` | statut correct, complet |
| Jaune | `--warning` | `#E8D25C` | statut attention |
| Rouge brique | `--danger` | `#F07F63` | statut surcharge, erreur, entrée de menu destructrice |
| Rouge (bouton) | `--danger-fill` | `#B23A26` | fond du bouton destructeur, libellé en `--text` |
| Gravure | `--engraving` | `#3A3E3E` | motif gravé complet |
| Gravure relevée | `--engraving-strong` | `#626767` | motif gravé simplifié des vignettes |
| Lettrine | `--initial` | `#8C837C` | lettrine de l'illustration par défaut |

- **L'orange est le même d'une édition à l'autre.** Relevé sur une vignette JPEG de l'affiche (l'aplat du texte orange), il est à confirmer sur le fichier source si on l'obtient.
- **Le texte blanc sur orange est exclu** (2,27:1) : le bouton principal porte un texte charbon.
- **Le charbon est neutre, légèrement froid**, comme le fond relevé sur l'affiche (`#1A1C1C`).
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

La taille de base du back office est de 13 px, posée dans son `styles.css`. Celle du front office se fixera avec ses patterns.

| Rôle | Police | Taille | Jeton |
|---|---|---|---|
| Titre de page (h1) | Uncial Antiqua | 26 px | `--font-size-title` |
| Titre de section (h2) | système, semi-gras | 18 px | `--font-size-section` |
| Titre de carte ou de bloc (h3) | système, semi-gras | 15 px | `--font-size-block` |
| Texte courant | système | 13 px | `--font-size-body` |
| Métadonnées, aide, compteurs | système | 12 px | `--font-size-meta` |
| Surtitres, en-têtes de créneau et de table | Aldrich, capitales, `letter-spacing: 0.12em` | 11 px | `--font-size-overline` |

- Interligne de 1,4 pour le texte, de 1,2 pour les titres.
- Aucune autre taille : les prototypes ont essayé 10,5, 11,5 et 12,5 px, l'échelle les ferme.

## Espacements

| Jeton | Valeur |
|---|---|
| `--space-xxs` | 2 px |
| `--space-xs` | 4 px |
| `--space-s` | 8 px |
| `--space-m` | 12 px |
| `--space-l` | 16 px |
| `--space-xl` | 24 px |
| `--space-xxl` | 32 px |

Aucune autre valeur. La marge intérieure courante d'un bloc du back office est de 8 px.

## Rayons

| Jeton | Valeur | Pour |
|---|---|---|
| `--radius-card` | 12 px | cartes, parties, dialogues, fiche latérale |
| `--radius-control` | 8 px | boutons, champs, menus, notifications |
| `--radius-thumb` | 6 px | vignettes |

Pastilles et badges sont en pilule (`999px`).

## Profondeur et halo

- **Pas d'ombres grises.** La profondeur vient des paliers de surface et des filets.
- **Halo** (`--halo`) : `0 0 0 1px` orange plus un flou de 10 px d'orange à 20 %. Il est réservé à l'élément saisi pendant un glisser-déposer et à une cible valide.
- **Halo discret** (`--halo-soft`) : un contour orange à 45 %, pour le survol d'une partie.
- Le halo ne remplace jamais l'anneau de focus, qui reste bleu.

## Densité du calendrier

Environ 0,8 px par minute dans la frise, soit 120 px pour un créneau de 2 h 30.

## Mouvement

- Micro-animations de moins de 200 ms : apparition d'un menu, retour d'une partie refusée à sa place, ouverture de la fiche latérale.
- Toutes désactivées sous `prefers-reduced-motion: reduce`.
