---
status: accepted
---

# Une règle vit sur l'objet, qui reçoit ses collaborateurs

Une méthode du domaine ne reçoit jamais en paramètre la condition de son propre refus : pas de `withdrawAvailability(slot, leadsThere: boolean)`. Quand l'appelant calcule le verdict, il peut se tromper ou contourner la règle sans que rien ne le signale. L'objet qui détient l'état vérifie donc la règle en entier. Si une donnée vit hors de son agrégat, la méthode reçoit le collaborateur entier (un agrégat, ou un objet du domaine que le repository ne fournit qu'entier) et lui pose la question elle-même : `convention.removeGameMaster(id, catalogue)` vérifie dans le catalogue des scénarios que le MJ n'en a aucun (PR-12).

## Considered Options

- **Un booléen ou un verdict passé en paramètre** : l'agrégat porte le refus, mais pas la règle. Écarté pour la raison ci-dessus.
- **La vérification dans la commande** (`application`), avec une contrainte en base comme filet : la règle sort du domaine, et chaque commande qui touche le même état doit la répéter.
- **Agrandir l'agrégat jusqu'à ce que toutes les données y soient** : retenu quand le coût reste faible, mais pas jusqu'aux scénarios, trop lourds à recharger à chaque commande.
- **Un port que le domaine interroge lui-même** (`scenarios.gameMastersOf(ids)`), passé en paramètre ou injecté dans l'agrégat : le domaine déclarerait un port et deviendrait asynchrone, avec des entrées-sorties au milieu de ses règles. Injecté, il cacherait en plus la dépendance et empêcherait de construire l'agrégat sans infrastructure. Écarté : le collaborateur est chargé par la commande avant l'appel, et le domaine reste synchrone.
- **Recopier une donnée d'un autre agrégat** : retenu seulement pour une donnée immuable qui voyage avec la référence dont elle dépend. Une partie porte l'identifiant de son scénario et celui du MJ de ce scénario dans un seul value object, construit à partir du `Scenario` : aucun des deux ne change sans l'autre. La copie n'est valable que tant que le MJ d'un scénario reste fixé (PR-16). Un transfert, s'il apparaissait, devrait être refusé tant que le scénario a des parties, ou mettre ses parties à jour dans la même transaction.

## Consequences

- Première application : les MJ et leurs disponibilités sont des enfants de l'agrégat `Convention`, avec les créneaux et les tables. L'unicité du pseudo (ID-7), la suppression des disponibilités avec leur créneau (PR-10) ou avec leur MJ (PR-12), et les heures figées par une disponibilité (PR-11) y deviennent des invariants internes. En contrepartie, deux MJ qui modifient leurs disponibilités en même temps écrivent dans le même agrégat.
- Deuxième application : les parties sont aussi des enfants de `Convention`. Les contraintes de programmation (PR-5), la suppression d'un créneau ou d'une table (PR-10), les heures figées (PR-11) et le retrait d'une disponibilité (PR-15) croisent les parties et la structure dans les deux sens. Un agrégat `Schedule` à part laisserait deux transactions vérifier chacune sa moitié de règle et réussir toutes les deux. `convention.schedule(scenario, timeSlotId, tableId)` reçoit le `Scenario` et en tire la référence au scénario et à son MJ : les contraintes qui touchent au MJ (PR-5, PR-15) deviennent des invariants internes, sans autre collaborateur. Toute écriture passant par `Convention`, l'agrégat porte un numéro de version : une écriture faite sur une version périmée est refusée (verrou optimiste).
- Le `Scenario` reste un agrégat à part. Il reçoit la `Convention` pour refuser un changement de durée ou une suppression quand il a des parties (PR-14).
- Un collaborateur passé en paramètre doit être complet par construction. Un catalogue partiel construit à la main fausserait la règle : le repository est le seul à fournir ces objets.
- Une contrainte en base (clé étrangère `RESTRICT`, index unique) peut doubler une règle comme protection contre un bug. Ce n'est pas l'endroit où vit la règle.
