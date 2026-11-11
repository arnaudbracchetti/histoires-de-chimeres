---
status: accepted
---

# Le contrôle d'accès lu sur le descripteur, la propriété portée par le chemin

Chaque descripteur de `contract` (ADR 0004) déclare son niveau d'accès : `public`, `linkedPhone`, `gameMaster` (session d'un MJ ou d'un Organisateur), `ownGameMaster` (le MJ dont le chemin porte le `:gameMasterId`, ou un Organisateur) ou `organizer`. Un descripteur sans niveau est réservé aux Organisateurs : un nouvel endpoint est fermé tant qu'on ne l'ouvre pas. Un garde global de NestJS lit ce niveau sur la route. Sans session, il répond 401. Avec une session qui n'a pas le droit, il répond 403 (Problem Details).

À chaque requête, le garde retrouve la session par son cookie, puis le compte, puis le participant et son `GameMaster` éventuel, par un seul port de lecture. Il ne garde rien en cache : retirer un rôle prend effet tout de suite. Il pose sur la requête l'identifiant du compte, l'indicateur Organisateur et le `gameMasterId`, ou `null`.

« Ce MJ » se vérifie par le chemin. Toute route où un MJ écrit sur ce qui est à lui passe sous `game-masters/:gameMasterId/…`, scénarios compris (`game-masters/:gameMasterId/scenarios/:scenarioId`, et de même pour l'image). Le garde compare `:gameMasterId` au MJ de la session, sans rien charger. La commande charge le scénario de ce MJ. Un scénario d'un autre MJ donne un 404 ordinaire, et non une règle d'accès. Le domaine ne reçoit aucun acteur, seulement un `gameMasterId`, comme avant.

Le niveau `linkedPhone` ne fait que documenter, et le garde le laisse passer. La vérification du téléphone relié reste dans les commandes (ADR 0009).

## Considered Options

- **Un décorateur Nest sur chaque méthode de controller** : le niveau serait dispersé dans les controllers, et rien n'empêcherait de l'oublier. Sur le descripteur, il est à côté de la route, et les fronts peuvent le lire pour masquer un geste interdit.
- **Un garde qui charge le propriétaire du scénario par un port** : chaque ressource possédée aurait son résolveur dans la couche HTTP, et chaque requête une lecture de plus.
- **Une commande qui reçoit un « demandeur » et vérifie elle-même** : l'accès se mêlerait aux règles métier. Chaque commande devrait penser à vérifier, ce qui contredit le refus par défaut.

## Consequences

- `endpoint()` reçoit un troisième argument facultatif, `{ access }`.
- `scenarioEndpoints.update`, `remove`, `changeImage` et `removeImage` changent de chemin. L'Organisateur les appelle avec le `gameMasterId` du scénario, qu'il a déjà dans le DTO.
- Un test e2e parcourt tous les descripteurs : sans session, chaque route non publique répond 401 ; avec une session de MJ, chaque route `organizer` répond 403. Un nouvel endpoint est couvert sans test à écrire.
