# Règles d'écriture de code

Les rails qu'on se fixe pour écrire le code. Les décisions d'architecture sont dans `docs/adr/`, la
charte d'IHM dans `docs/design/`. Ici : le nommage et les habitudes d'écriture.

## Nommage des méthodes du domaine

Un nom de méthode dit seul **ce qu'elle fait** et **de quelles données elle a besoin**. On ne doit
pas lire ses paramètres pour la comprendre. Chaque nom commence par un **verbe** qui dit la nature
de l'action, suivi de la donnée traitée. Les noms restent courts : on coupe ce que le verbe ou le
type rend évident.

| Nature | Verbe | Exemple |
|---|---|---|
| Vérifie, lève un refus | `verify…` | `verifyStillOpenAt(now)` |
| Répond oui / non | `is…`, `has…` | `isScenarioScheduled(scenarioId)` |
| Cherche, peut ne rien trouver (`undefined` / `null`) | `find…` | `findGameMasterOfParticipant(id)` |
| Cherche par identifiant, lève « introuvable » | `findExisting…ById` | `findExistingGameById(gameId)` |
| Lit une donnée simple | `get…` | `getTimeSlotRank(timeSlotId)` |
| Compte | `count…` | `countGamesAtTable(tableId)` |
| Liste | `list…` | `listEntries()` |
| Calcule une donnée dérivée (verdicts, réserve, situation, fin) | `compute…` | `computeReserve(catalogue)` |
| Fabrique un objet (refus, notification) | `build…` | `buildGameMovedNotifications(…)` |
| Fabrique statique | `create…`, `parse…`, `restore` | `ComparableName.createFromText(text)` |
| Modifie l'objet | verbe du geste | `scheduleScenario(…)`, `withdrawFromGame(…)` |
| Objet immuable : rend le nouvel objet | `get<Type>After<Geste>` | `getDayAfterAddingTimeSlot(…)` |

- Les getters (`timeSlots`, `games`, `end`) restent des noms : ce sont des propriétés.
- `equals`, `compareTo`, `isBefore`, `toString` gardent leur nom (conventions du langage).
- Jamais `after…` ou `get…After…` pour une méthode qui modifie l'objet : elle prend le verbe du geste.
- Pas de nom laconique (`with`, `without`, `renamed`, `movedTo`, `of`). Ne pas recopier un nom
  laconique existant par cohérence : le signaler et proposer un nom descriptif.
- Quand on touche un fichier, on corrige aussi ses noms laconiques.
- Un appel dont on jette le résultat pour vérifier s'appelle `verify…`.
- « Mener » se dit `lead` partout (`isGameMasterLeadingOnTimeSlot`, code de refus
  `leads-game-on-time-slot`).
- Les termes du domaine viennent de `GLOSSARY.md` : `signUp` / `withdraw` pour l'inscription,
  « verdict de placement » pour `Placement`.

## Règles métier

- Une règle vit en entier sur l'objet qui détient l'état. Une méthode ne reçoit jamais la
  condition de son propre refus (un booléen calculé par l'appelant). Si la donnée est hors de
  l'agrégat, elle reçoit le collaborateur entier et l'interroge elle-même (ADR 0005).
- Le domaine refuse par une exception typée (`Refusal` : un code et des paramètres, sans texte).
  Le message français est écrit par l'API (ADR 0008).
- Pas de code en double entre le back office et le front office : toute logique commune va dans
  `packages/design` (sans framework) ou dans `contract` (voir `CLAUDE.md`).

## Textes visibles

- Une espace insécable devant « : » dans tout texte que voit l'utilisateur, messages de l'API
  compris. Les guillemets et les signes « ; ! ? » suivent `docs/design/ton.md`. Toute nouvelle
  phrase visible passe par `fr` de `@chimeres/design`.
- Un écart à la charte déjà présent dans le code n'est pas une raison de le reproduire : le corriger
  ou le signaler.
- Une erreur affichée ne décale jamais rien dans la page (voir `docs/design/patterns.md`,
  Validation).

## Langues

- Code en anglais, commentaires et textes visibles en français (ADR 0003).

## Travail avec Git

- Rien n'est commité sans l'accord explicite de l'utilisateur.
- Les commits vont directement sur `main`, sans branche.
