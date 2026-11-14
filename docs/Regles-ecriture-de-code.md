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
| Fabrique un objet (refus, notification) | `build…` | `buildOversubscribedNotifications(…)` |
| Fabrique statique | `create…`, `parse…`, `restore` | `ComparableName.createFromText(text)` |
| Modifie l'objet | verbe du geste | `scheduleScenario(…)`, `withdrawFromGame(…)` |
| Objet immuable : rend le nouvel objet | `get<Type>After<Geste>` | `getDayAfterAddingTimeSlot(…)` |

- Les getters (`timeSlots`, `games`, `end`) restent des noms : ce sont des propriétés.
- `equals`, `compareTo`, `isBefore`, `toString` gardent leur nom (conventions du langage).
- Jamais `after…` ou `get…After…` pour une méthode qui modifie l'objet : elle prend le verbe du geste.
- Pas de nom laconique (`with`, `without`, `renamed`, `movedTo`, `of`). Ne pas recopier un nom
  laconique existant par cohérence : le signaler et proposer un nom descriptif.
  `pnpm lint` les signale (`pnpm lint:naming`, plugin `tools/lint/naming-plugin.js`), en
  avertissement tant que le code existant en garde.
- Quand on touche un fichier, on corrige aussi ses noms laconiques.
- Un appel dont on jette le résultat pour vérifier s'appelle `verify…`.
- « Mener » se dit `lead` partout (`isGameMasterLeadingOnTimeSlot`, code de refus
  `game-led-by-participant`).
- Les termes du domaine viennent de `GLOSSARY.md` : `signUp` / `withdraw` pour l'inscription,
  « verdict de placement » pour `Placement`.

## Règles métier

- Une règle vit en entier sur l'objet qui détient l'état. Une méthode ne reçoit jamais la
  condition de son propre refus (un booléen calculé par l'appelant). Si la donnée est hors de
  l'agrégat, elle reçoit le collaborateur entier et l'interroge elle-même (ADR 0005).
- Le domaine refuse par une exception typée (`Refusal` : un code et des paramètres, sans texte).
  Le message français est écrit par l'API (ADR 0008).
- Un front affiche les états et les verdicts que l'API calcule. Il ne combine pas deux données de
  l'API, ni une donnée et son horloge, pour en tirer un état métier : l'état manque ? L'API le
  calcule, dans le domaine, et le contrat le porte (exemple : « Terminé » d'un créneau).
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

## Migrations de la base

Le retour arrière relance l'image précédente sur le schéma de la nouvelle version, sans restaurer
la base (ADR 0021). Chaque migration doit donc le permettre.

- **Un seul cran garanti** : la version N-1 tourne sur le schéma de N. Pas plus loin : remonter
  à N-2 passe par la restauration d'un dump.
- **Une version n'ajoute que** : une table, un index, une colonne nullable, ou une colonne
  `NOT NULL` avec un `DEFAULT`. N-1 ignore ce qu'elle ne connaît pas.
- **Un changement destructif se fait sur deux versions** : N cesse de lire et d'écrire la colonne
  ou la table, N+1 la supprime. Même chose pour rendre une colonne obligatoire ou changer son type.
- **Un renommage se fait par ajout** : N ajoute la nouvelle colonne, y copie l'ancienne et écrit
  dans les deux ; N+1 ne lit plus que la nouvelle ; une version suivante supprime l'ancienne.
- **Exception** : une migration qui ne peut pas suivre ces règles porte la ligne
  `-- incompatible : <raison>`. Le retour arrière de cette version passe alors par le dump fait
  avant le déploiement, et on le signale à la publication.
- **Une valeur nouvelle dans une colonne existante** (une valeur d'énumération, un nouvel état)
  ne change pas le schéma, mais N-1 ne sait pas la lire : on la signale à la publication, et le
  retour arrière restaure le dump.
- `pnpm check:migrations` refuse, dans les migrations postérieures au premier déploiement, tout
  `DROP`, `RENAME`, `SET NOT NULL` ou `ALTER COLUMN … TYPE` sans la ligne `-- incompatible`
  (`apps/api/scripts/check-migrations.ts`). Les migrations écrites par `prisma migrate dev` sont
  à relire : un renommage dans `schema.prisma` y devient un `DROP` suivi d'un `ADD`.

## Langues

- Code en anglais, commentaires et textes visibles en français (ADR 0003).

## Travail avec Git

- Rien n'est commité sans l'accord explicite de l'utilisateur.
- Les commits vont directement sur `main`, sans branche.
