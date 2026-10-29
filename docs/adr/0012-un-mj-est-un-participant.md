---
status: accepted
---

# Un MJ est un participant : le pseudo vit sur le participant, le MJ en est un rôle

Un MJ joue sur les créneaux où il ne mène pas : il s'inscrit, il est tiré au sort, il reçoit une affectation et des notifications, comme tout participant. Chaque MJ a donc son `Participant`, qui porte son pseudo, le seul de la personne. `GameMaster` garde ce qui est propre au MJ (disponibilités, scénarios, parties menées) et désigne son participant ; il n'a pas de pseudo à lui. Être MJ, c'est avoir un `GameMaster` relié à son participant, sans indicateur à tenir à jour. Les inscriptions, le tirage, les affectations, les notifications et le téléphone relié ne connaissent ainsi que des participants.

## Considered Options

- **Le téléphone relié à un participant ou à un MJ** (deux clés dans `LinkedPhone`) : simple pour l'identification, mais chaque geste à venir (inscription, tirage, affectation, fusion, notification) aurait dû viser un participant ou un MJ, et traiter le MJ à part.
- **Un participant jumeau, avec son propre pseudo** : deux pseudos à garder égaux quand un Organisateur renomme le MJ, et une unicité à vérifier entre deux ensembles.
- **Un indicateur « MJ » sur le participant** : il aurait doublé l'existence du `GameMaster`, sans porter ses disponibilités ni ses scénarios.

## Consequences

- Un seul ensemble de pseudos, celui des participants : ID-4 et l'unicité de PR-12 en découlent, sans vérification croisée.
- Créer un MJ crée son participant ; renommer un MJ renomme son participant, et ses liens restent. ID-9 n'interdit qu'au participant de modifier lui-même son pseudo. Supprimer un MJ supprime son participant, donc ses liens et, plus tard, ses inscriptions (PR-12, ID-10).
- `identify()` trouve un participant ; s'il est MJ, la confirmation demandée est « Es-tu bien ce MJ ? » (ID-3), sinon « Ce pseudo existe déjà » (ID-1). Le téléphone relié ne désigne qu'un participant.
- IN-4 devient une règle du participant : son MJ mène-t-il une partie sur ce créneau ?
- Dans le domaine, `GameMaster` contient son `Participant`, et son getter `nickname` lit le pseudo de celui-ci : qui lit le pseudo d'un MJ n'a pas à passer par son participant. La convention garde l'unicité sur l'ensemble de ses participants, MJ compris.
- En base, `GameMaster.participantId` est unique et retient son participant (RESTRICT) : seule la suppression du MJ supprime son participant. Les lectures du back office prennent le pseudo d'un MJ par son participant.
- La fusion (ID-11) vers un pseudo de MJ vise son participant, comme toute autre destination.
