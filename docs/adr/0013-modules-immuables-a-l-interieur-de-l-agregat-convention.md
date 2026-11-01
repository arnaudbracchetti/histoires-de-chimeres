---
status: accepted
---

# Des modules immuables à l'intérieur de l'agrégat Convention

`Convention` reste le seul agrégat de la répartition : une transaction, une version ([ADR 0005](0005-une-regle-vit-sur-l-objet-qui-recoit-ses-collaborateurs.md), deuxième application). Pour qu'elle ne grossisse pas avec chaque règle, son état se découpe en modules internes, sur le modèle de `Day` (Journée) et de `Schedule` (Programme). Chaque module détient une partie de l'état et en garde les règles. Il est immuable : chaque geste rend un nouveau module (`get<Type>After<Geste>`), et un refus laisse tout en l'état. Il reçoit à chaque appel les autres modules dont il a besoin, en lecture : l'ADR 0005 s'applique un étage plus bas. `Convention` garde sa version, la séquence de chaque geste (calculer les modules d'après, en tirer les notifications, remplacer les références) et une interface publique stable : commandes, repository et API ne voient pas le découpage.

Première application : `SignUps` (Inscriptions) garde IN-2 à IN-6. IN-4, l'inscription active, y est écrite une fois, et le lecteur Prisma du front office la reprend par `SignUps.isSignUpActive()`. Le module déclare ce qu'il lit hors de lui (`SignUpCollaborators` : le Programme et `LedGames`, les parties que mène chaque participant), et `Convention` le lui fournit, tiré du même état.

## Considered Options

- **Des agrégats à part** (Inscriptions, Programme) : deux transactions vérifieraient chacune sa moitié d'une règle qui les croise (IN-4, IN-6, PR-5), et réussiraient toutes les deux. Écarté pour la même raison que dans l'ADR 0005.
- **Des modules liés à leurs collaborateurs à la construction** : les appels seraient plus légers, mais un module gardé avec un vieux Programme donnerait un faux résultat sans rien signaler.
- **Garder tout dans `Convention`** : la classe dépassait mille lignes, et IN-4 y était réécrite à six endroits, avant le suivi des inscriptions et le tirage, qui la relisent encore.

## Consequences

- Les specs restent écrites à travers `Convention` : son interface est la surface de test. Un module n'a sa spec propre que pour une règle difficile à atteindre par elle.
- Le refus et la notification qu'une règle d'un module décide gardent leurs paramètres d'affichage (rang, table, échéance). Le module lève lui-même ses refus, avec les collaborateurs qu'il faut. Pour une notification, il désigne les destinataires, et `Convention` l'assemble ([ADR 0010](0010-le-geste-du-domaine-produit-ses-notifications.md)).
- Les découpages suivants (notifications d'un changement de Programme, Personnes, Tirages) suivent le même modèle.
