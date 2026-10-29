# Ton et rédaction

Tout ce qui suit vaut pour les deux fronts : rien n'y est propre au back office.

## Voix

- **Tutoiement partout**, dans les deux fronts.
- Voix **directe et brève**, au présent, sans jargon technique.
- Un **message d'erreur dit ce qui s'est passé et quoi faire** : « Le créneau 2 porte 3 parties : déprogramme-les d'abord. »
- **L'humour discret est réservé aux états vides.** Jamais dans une erreur, une confirmation ou un statut.

## Vocabulaire

Seuls les termes de [GLOSSARY.md](../../GLOSSARY.md) apparaissent à l'écran, et jamais ses termes _Avoid_ : Partie, pas « session » ; Créneau, pas « slot » ; Programmer, pas « planifier » ; Jeu, pas « système ».

« Annuler » est réservé, dans le domaine, à la partie sous son minimum après le tirage. À l'écran :

- « Annuler » **seul** ferme un dialogue ou une saisie sans rien faire ;
- « Annuler la partie » est l'action du domaine, toujours avec son objet.

## Micro-rédaction

- **Boutons et entrées de menu à l'infinitif**, avec leur objet dès que le verbe seul est ambigu : « Ajouter une table », « Supprimer le créneau », « Déplacer vers… », « Programmer ici ».
- **La réponse à une question** reprend la question, à la place de l'infinitif : « Oui, c'est moi », « Non, choisir un autre pseudo ».
- Des **points de suspension** quand l'action ouvre un choix avant d'agir : « Programmer sur… ».
- **Majuscule au premier mot seulement**, titres compris : « Créneaux et tables ».
- **Pas de point d'exclamation.**
- Une **question de confirmation** nomme l'objet : « Supprimer le créneau 2 ? ».
- Un **libellé de champ** est un nom, sans deux-points : « Titre », « Places minimum ». Les champs facultatifs portent la mention « facultatif ».
- Les messages de l'API (`title` et `detail`, [ADR 0008](../adr/0008-le-domaine-donne-un-code-l-api-ecrit-le-message.md)) suivent les mêmes règles. Les fronts les affichent tels quels.

## Typographie française

- Guillemets français « », avec une espace insécable à l'intérieur.
- Espace fine insécable (U+202F) devant ; ! ?, espace insécable (U+00A0) devant :.
- Nombres : espace fine insécable pour les milliers (« 1 500 caractères »), virgule décimale.
- Espace insécable entre un nombre et son nom ou son unité : « 4 places », « 24 heures », « 10 Mo ».
- Dans le code des deux fronts, une phrase visible passe par l'étiquette `fr` de `@chimeres/design`, qui pose ces espaces ; un gabarit HTML écrit `&nbsp;` et `&#8239;`. Aucune espace insécable n'est tapée en clair : `pnpm lint` le vérifie (`check-typography`, du même package).
- Les heures, les plages, les durées, les rangs de créneaux et la date de la convention s'écrivent par les fonctions de `@chimeres/design` (`formatTime`, `formatTimeRange`, `formatDuration`, `timeSlotLabel`, `formatConventionDate`…), les mêmes dans les deux fronts.

## Dates, heures et durées

| Quoi | Format | Exemple |
|---|---|---|
| Date de la convention | jour, quantième, mois, année | « samedi 14 mars 2027 » |
| Date pas encore fixée | | « date à fixer » |
| Heure | `H h MM`, espaces insécables | « 14 h 00 », « 9 h 30 » |
| Heure saisie | `hh:mm`, sur 24 heures | « 14:00 », « 09:30 » |
| Créneau | rang, puis plage | « Créneau 2 · 14 h 00 – 18 h 30 » |
| Durée | heures et minutes | « 4 h 30 », « 2 h », « 45 min » |
| Ratio | `N / M`, chiffres à chasse fixe | « 42 / 36 » |

- Un créneau est désigné par son **rang dans la journée** (PR-8), jamais par ses seules heures.
- Le tiret d'une plage est un demi-cadratin (–) entouré d'espaces fines insécables.
