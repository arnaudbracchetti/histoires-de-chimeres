---
status: accepted
---

# L'algorithme de tirage derrière une interface du domaine

L'algorithme de tirage est le cœur du métier (TI-4), et il pourra changer. On l'isole derrière une interface étroite, `DrawAlgorithm` (Algorithme de tirage), déclarée dans `domain` avec ses types d'entrée et de sortie, puisque `Convention` la reçoit au lancement et à la relance d'un tirage ([ADR 0005](0005-une-regle-vit-sur-l-objet-qui-recoit-ses-collaborateurs.md)). L'implémentation vit dans un package à part, `packages/draw`, sans framework, qui ne dépend que de `domain`. L'API la câble par un jeton, avec la source de hasard, et la passe à la commande, comme `Clock`. Changer d'algorithme, c'est changer une ligne de ce câblage : un seul est actif, et les Organisateurs ne le choisissent pas à l'écran.

L'interface ne voit que le créneau tiré. En entrée : les participants du tirage, chacun avec les parties du créneau où il est inscrit (aucune pour un participant sans partie) ; les parties qui commencent sur le créneau, sans les parties annulées, avec leurs places minimum et maximum ; une source de hasard. En sortie : pour chaque participant, sa partie, ou « non placé ». Tout passe par des identifiants opaques, sans pseudo ni heure d'inscription : la promesse « rien d'autre ne pèse » (ni l'ordre d'inscription, ni l'alphabet) est tenue par construction.

`Convention` vérifie la sortie avant de l'accepter : chaque participant y figure une fois, aucune partie ne dépasse son maximum, chacun est sur une partie où il est inscrit. Une sortie fautive est une erreur interne, pas un refus (`Refusal`) : l'Organisateur n'y peut rien, et rien n'est sauvegardé. Les règles absolues de TI-4 ne dépendent donc pas de l'algorithme, pas plus que les ajustements (déplacer un participant, annuler ou rétablir une partie, relancer, rouvrir les inscriptions) ni la publication, qui restent dans le domaine.

## Considered Options

- **L'algorithme dans `domain`, appelé directement par `Convention`** : un seul package de moins, mais en changer toucherait l'agrégat, et ses tests (dénombrement, couplage) se mêleraient à ceux des règles des gestes.
- **Un choix d'algorithme par les Organisateurs** (réglage de la convention) : aucun besoin connu en V1, et un réglage de plus à expliquer le jour J.
- **L'agrégat entier en entrée de l'algorithme** : un futur algorithme pourrait lire l'historique des créneaux, mais aussi les pseudos et l'heure des inscriptions, et la promesse d'équité ne se vérifierait plus par construction. Un algorithme qui a besoin de plus élargira l'interface ce jour-là.
- **Le hasard tiré par l'algorithme lui-même** (`Math.random`) : les tests ne pourraient pas rejouer un tirage, ni vérifier l'équité à graine fixe.

## Consequences

- Une suite de tests de contrat, que tout algorithme doit passer : les règles absolues, le participant sans partie qui reste non placé, et « mêmes inscriptions, mêmes chances », vérifiée à graine fixe sur des créneaux qui coupent des groupes d'inscriptions identiques. Chaque algorithme a en plus ses tests propres (placer le plus, parties au minimum, équilibre).
- Les specs de `Convention` passent un faux algorithme réglable : elles vérifient les gestes et le refus d'une sortie fautive sans dépendre du vrai calcul.
- `packages/draw` ne connaît ni la convention, ni le programme, ni les inscriptions : seulement l'entrée de l'interface.
- La partie double ne demande rien à l'algorithme : il la traite comme une partie de son premier créneau. C'est le domaine qui retire ses joueurs du tirage du créneau suivant (TI-3).
