---
status: accepted
---

# Erreurs de l'API : le domaine donne un code, l'API écrit le message

Le domaine fait seul autorité sur les règles. Quand il refuse, il lève une exception typée qui porte un code, tiré d'une union fermée déclarée dans `contract` (`game-master-unavailable`, `table-name-taken`…), et des paramètres, sans aucun texte. Un filtre d'exception global de l'API la traduit en Problem Details (RFC 9457, `application/problem+json`), et un catalogue de l'API associe à chaque code un `title` court (le motif : « MJ indisponible »), un `detail` construit avec les paramètres (« Kaïros mène déjà « Néons sur Neo-Paris » sur le créneau 1. ») et, s'il y en a un, le champ concerné. Les fronts affichent ces textes tels quels et ne lisent le `code` que pour décider d'un comportement. L'écran de programmation doit montrer les motifs de PR-5 avant tout geste : il les obtient par une lecture de l'API, qui calcule le verdict de chaque placement avec la règle même qui refuse l'écriture. Ainsi, chaque règle et chaque phrase n'existent qu'à un seul endroit.

## Considered Options

- **Schémas de validation partagés dans `contract` (zod)** : les fronts valideraient avec les mêmes règles, mais `contract` dépendrait d'une bibliothèque, ce que l'ADR 0004 a refusé pour ts-rest. Les règles qui croisent plusieurs objets (unicité, PR-5) resteraient de toute façon au domaine.
- **DTO en classes avec class-validator** : les règles seraient écrites une deuxième fois dans l'API, et les DTO de `contract` sont des types, pas des classes.
- **Messages écrits par les fronts à partir du code** : le catalogue existerait deux fois, une par front.
- **PR-5 réimplémentée dans le front** pour éclairer les cibles sans aller-retour : la réponse serait instantanée, mais la règle existerait en double, contre l'ADR 0005.

## Consequences

- À l'entrée, l'API ne vérifie que la forme du corps, avec zod, dans `apps/api` seulement. Chaque schéma est typé contre le `…Body` de `contract` : un écart casse la compilation. Une forme invalide donne un 400 `malformed-request`, qu'un front correct ne provoque jamais.
- Statuts : 404 pour un élément introuvable, 413 et 415 pour une image trop lourde ou d'un format refusé, 422 pour le refus d'une règle du domaine, 409 `concurrent-modification` et 500 `internal-error` sans détail. Problem Details porte deux extensions : `code` et `errors` (`{ field, code, message }`). `ProblemDto` vit dans `contract`.
- Les controllers ne font plus de `try/catch` : le filtre global traduit toutes les erreurs.
- Le domaine s'arrête au premier refus. Pour que l'Organisateur ne découvre pas ses erreurs une par une, les formulaires doublent les seules règles locales à un champ (obligatoire, longueurs, 1 ≤ min ≤ max). Leurs bornes sont des constantes de `contract`, et un test dans `application` vérifie qu'elles concordent avec celles du domaine.
- La version de `Convention` (verrou optimiste) reste interne au serveur : le client n'en envoie jamais. Une commande en conflit est rejouée une fois dans `application`, ce qui revérifie les règles sur l'état frais, puis l'API renvoie 409.
- Le back office affiche une erreur rattachée à un champ sous ce champ (`submit()` de Signal Forms), et les autres dans un bandeau `role="alert"` en haut du formulaire, sans perdre la saisie.
