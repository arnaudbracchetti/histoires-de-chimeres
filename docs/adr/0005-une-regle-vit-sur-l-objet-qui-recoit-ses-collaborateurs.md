---
status: accepted
---

# Une règle vit sur l'objet, qui reçoit ses collaborateurs

Une méthode du domaine ne reçoit jamais en paramètre la condition de son propre refus : pas de `withdrawAvailability(slot, leadsThere: boolean)`. Quand l'appelant calcule le verdict, il peut se tromper ou contourner la règle sans que rien ne le signale. L'objet qui détient l'état vérifie donc la règle en entier. Si une donnée vit hors de son agrégat, la méthode reçoit le collaborateur entier (un agrégat, ou un objet du domaine que le repository ne fournit qu'entier) et lui pose la question elle-même : `convention.removeGameMaster(id, catalogue)` vérifie dans le catalogue des scénarios que le MJ n'en a aucun (PR-12).

## Considered Options

- **Un booléen ou un verdict passé en paramètre** : l'agrégat porte le refus, mais pas la règle. Écarté pour la raison ci-dessus.
- **La vérification dans la commande** (`application`), avec une contrainte en base comme filet : la règle sort du domaine, et chaque commande qui touche le même état doit la répéter.
- **Agrandir l'agrégat jusqu'à ce que toutes les données y soient** : retenu quand le coût reste faible, mais pas jusqu'aux scénarios, trop lourds à recharger à chaque commande.

## Consequences

- Première application : les MJ et leurs disponibilités sont des enfants de l'agrégat `Convention`, avec les créneaux et les tables. L'unicité du pseudo (ID-7), la suppression des disponibilités avec leur créneau (PR-10) ou avec leur MJ (PR-12), et les heures figées par une disponibilité (PR-11) y deviennent des invariants internes. En contrepartie, deux MJ qui modifient leurs disponibilités en même temps écrivent dans le même agrégat.
- Le `Scenario` reste un agrégat à part. Il reçoit le programme pour refuser un changement de durée ou une suppression quand il a des parties.
- Un collaborateur passé en paramètre doit être complet par construction. Un catalogue partiel construit à la main fausserait la règle : le repository est le seul à fournir ces objets.
- Une contrainte en base (clé étrangère `RESTRICT`, index unique) peut doubler une règle comme protection contre un bug. Ce n'est pas l'endroit où vit la règle.
