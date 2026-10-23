# Identité

## Référence

L'application suit **l'affiche de la Convention 2026**, et non le site de l'association. L'affiche mène au programme par son QR code : le participant passe de l'une à l'autre sans rupture.

L'affiche, c'est un fond charbon, un médaillon gravé gris en fond, un dragon et un d20 orange, un titre en onciale et des capitales grises espacées. Les cartes d'événement de l'association (Chimeresy, Kill'Chim) suivent la même grammaire, avec une couleur par événement.

L'association apparaît par son nom (« par les Tisseurs de Chimères »), pas par son logo.

## Registre

- **Thème sombre seul**, dans les deux applications. Il n'y a pas de thème clair.
- **Sobre dans les zones de travail** : tableaux, formulaires, programmation. Ni texture ni photo derrière les données.
- **L'univers se montre aux seuils** : en-tête, accueil, états vides, cartes de scénario. Le front office est plus incarné que le back office.
- **Moderne et chaleureux**, pas classique et froid.
- **Déclinaison « Atelier »** : dense, paliers de surface neutres et resserrés, filets de 1 px, halo fin, images au naturel. Les valeurs sont dans [jetons.md](jetons.md).

## Emblème

Dessiné par nous en SVG, faute de vecteur du logo de l'association.

- **Anneau en segments** : douze segments en gris chauds de l'affiche, dont trois orange, autour d'une toile orange avec sa spirale centrale.
- **Version ≤ 32 px** : la toile se simplifie, en 6 rayons et 3 fils.
- **Usages** :
  - marque dans l'en-tête, à côté de « Histoires de Chimères » en Uncial Antiqua ;
  - icône de la PWA (512 px et maskable), dont les PNG sont tirés une fois de l'emblème et versionnés.

## Motif gravé

Anneaux, graduations et spirale, d'après le médaillon de l'affiche, en gris peu contrasté. Il est décoratif, masqué aux lecteurs d'écran, et n'apparaît qu'aux seuils : en-tête, accueil, états vides, illustration par défaut.

Il existe en deux versions, comme l'emblème :

| Version | Où | Dessin | Traits | Jeton |
|---|---|---|---|---|
| **Complète** | en-tête, états vides, carte 3:2 du front office, bandeau 4:1 | anneaux, graduations, spirale | en unités du dessin | Gravure |
| **Simplifiée** | vignettes de 32 et 44 px | deux anneaux (le dernier plus épais), douze graduations | un pixel d'écran (1,5 px pour l'anneau extérieur), `vector-effect: non-scaling-stroke` | Gravure relevée |

Réduit tel quel, le motif complet a des traits de 0,19 px à 32 px, et Gravure ne fait que 1,28:1 sur Anthracite 3 : il disparaît. D'où la version simplifiée.

## Illustration par défaut d'un scénario

Un scénario sans image (PR-7) prend une illustration dessinée côté client en SVG, à partir de son titre. Rien n'est généré ni stocké, et elle s'affiche hors ligne puisqu'elle fait partie du code.

- **Lettrine** : l'initiale du titre, en Uncial Antiqua, centrée dans les anneaux du motif, couleur Lettrine. Elle est décorative et masquée aux lecteurs d'écran : le titre est toujours écrit à côté.
- **Article ignoré** : l'initiale est celle du premier mot après un article de tête (le, la, les, l', un, une, des ; the, a, an), mise en capitale. « La Tour d'ébène » → T. C'est la fonction `initialOf` de `@chimeres/design`.
- **Formes onciales acceptées** : certaines initiales prennent leur forme minuscule en Uncial Antiqua (D, H, M deviennent ð, h, m).
- **Motif commun**, sans spirale (la lettrine occupe le centre), sans emblème en filigrane, sans cadrage propre au scénario : deux scénarios de même initiale ont la même illustration, et leur titre les distingue.
- **Placement** : lettrine et anneaux centrés dans une vignette ; centrés sur le tiers droit et dans le haut de la carte 3:2 (au-dessus du dégradé et du texte) ; sur le quart droit du bandeau 4:1.

## Images de scénario

- L'image d'un scénario apparaît **partout où le scénario apparaît**, ou à défaut son illustration par défaut.
- **Un seul format** : paysage 3:2, recadré au centre par le serveur (1200 × 800 px au plus, [ADR 0007](../adr/0007-images-de-scenario-stockees-en-base.md)). Vignette carrée et bandeau en dérivent en CSS (`object-fit: cover`).
- **Couleurs d'origine**, sans filtre ni virage.
- **Back office** : vignette carrée de 32 px dans la frise et les tableaux, de 44 px dans la réserve, aperçu 3:2 dans la zone image de la page d'un scénario.
- **Front office** : grande carte 3:2, l'image en fond, un dégradé charbon sous le texte. Pas d'effet de verre (`backdrop-filter`) : coûteux sur téléphone, et au contraste imprévisible.

## Inspirations

| Inspiration | Ce qu'on prend | Ce qu'on ne prend pas |
|---|---|---|
| Tableau de CRM | densité, pastilles de statut, barre latérale, filtres sur les listes longues | |
| Tableau de serveurs | lignes en cartes avec statut, pour le front office (mes inscriptions, mes parties) | dans le back office, qui garde de vrais tableaux |
| Planning d'une journée, agenda en timeline | blocs horaires sur un axe, pause affichée entre deux blocs | |
| Cartes de minuteurs | grande carte arrondie, image en fond, dégradé sous le texte | l'effet de verre |
| Tuiles colorées | | tout : aucune catégorie de scénario à coder en couleur, et des aplats pastel qui jurent avec le sombre |

## Accessibilité : WCAG 2.2 AA

Vérifiée pendant le développement, sans audit.

- Contraste de 4,5:1 pour le texte, de 3:1 pour les composants et le focus. Les couples vérifiés sont dans [jetons.md](jetons.md).
- Tout le back office se manie au clavier, avec un focus visible.
- Aucune information ne passe par la couleur seule : un statut a toujours une icône et un libellé.
- Aucune action ne passe seulement par le glisser-déposer (critère 2.5.7, voir [patterns.md](patterns.md#programmation)).
- Les cibles tactiles du front office font au moins 44 px.
- `prefers-reduced-motion` est respecté.
- Les décors (motif gravé, lettrine, emblème à côté du nom écrit) sont masqués aux lecteurs d'écran.
