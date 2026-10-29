# Charte d'IHM

La charte fixe l'identité commune aux deux applications : le front office, PWA mobile des participants et des MJ, et le back office, sur ordinateur, des MJ et des Organisateurs. Elle en détaille les patterns : ceux du back office, et ceux du front office, qui s'y ajoutent écran par écran.

| Fichier | Contenu | À lire pour |
|---|---|---|
| [identite.md](identite.md) | Registre, emblème, motif gravé, illustration par défaut, images, accessibilité | tout écran, toute image |
| [jetons.md](jetons.md) | Couleurs, contrastes, polices, échelles typographiques des deux fronts, interlignes, espacements, rayons, halo, mouvement | tout CSS |
| [ton.md](ton.md) | Voix, micro-rédaction, typographie, formats de date et d'heure | tout texte visible |
| [patterns.md](patterns.md) | Ce qui vaut pour les deux fronts ; coquille, formulaires, erreurs sans décalage, tableaux, états, actions destructrices, retours d'action, statuts, focus, programmation du back office | tout écran |
| [patterns-front-office.md](patterns-front-office.md) | Mesures du téléphone, coquille et historique, boîte du pseudo, parcours d'identification, champs, boutons, alertes, dialogue de confirmation, patterns à venir | tout écran du front office |
| [ecriture-css.md](ecriture-css.md) | Couches, encapsulation, unités, icônes, composants partagés | tout composant |

## Ce qui fait foi

- Les **valeurs** (couleurs, tailles, rayons) sont fixées par [`packages/design/tokens.css`](../../packages/design/tokens.css). [jetons.md](jetons.md) ne garde que les rôles, les contrastes et la correspondance avec les noms de la charte.
- Le **vocabulaire** est celui de [GLOSSARY.md](../../GLOSSARY.md), interface comprise.
- Le **choix technique** (CDK, Angular Aria, CSS natif, package `@chimeres/design`) est l'[ADR 0006](../adr/0006-interface-sans-bibliotheque-de-composants.md). Les erreurs de l'API et leurs messages relèvent de l'[ADR 0008](../adr/0008-le-domaine-donne-un-code-l-api-ecrit-le-message.md).

## D'où vient la charte

Elle consigne les décisions de la carte [Initialiser une convention dans le back office, et charte d'IHM](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/1), dont le détail et les options écartées restent dans les tickets :

- [Intentions d'identité visuelle](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/7) ;
- [Pistes visuelles](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/8) ;
- [Illustration par défaut d'un scénario](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/18) ;
- [Choix technique de l'interface](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/10) ;
- [Coquille du back office : architecture de l'information et navigation](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/11) ;
- [Écran de programmation](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/12) ;
- [Écritures dans l'API : validation des commandes et erreurs](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/13) ;
- [Patterns du back office et rédaction de la charte](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/16).

Les prototypes HTML qui ont servi à trancher vivent sur des branches jetables, jamais fusionnées (`prototype/pistes-visuelles`, `prototype/illustration-par-defaut`, `prototype/coquille-back-office`, `prototype/ecran-de-programmation`, et pour le front office `prototype/parcours-d-accueil`, `prototype/coquille-front-office`, `prototype/fiche-de-partie`, `prototype/vue-du-mj`). Ils ne sont qu'un historique : en cas d'écart, la charte l'emporte.
