---
status: accepted
---

# Retour arrière par l'image précédente, sans restauration

Revenir à la version précédente relance son image sur la base telle qu'elle est, sans restaurer
le dump fait avant le déploiement. Les inscriptions et les scénarios saisis depuis le déploiement
restent. En contrepartie, chaque migration laisse tourner la version précédente : elle n'ajoute
que, et un changement destructif se répartit sur deux versions (`docs/Regles-ecriture-de-code.md`,
« Migrations de la base »). `pnpm check:migrations` le vérifie, et la CI le lancera (#193). Une
migration qui ne peut pas suivre la règle se déclare par `-- incompatible : <raison>`, et son
retour arrière passe par le dump.

## Considered Options

- **Toujours restaurer le dump au retour arrière** : aucune contrainte sur les migrations, mais
  tout ce qui a été saisi depuis le déploiement est perdu, en pleine saison d'inscription.

## Consequences

- Une suppression ou un renommage demande deux versions au lieu d'une.
- Prisma 7.10.1 : `migrate deploy` de N-1 passe sans erreur sur une base qui contient une
  migration qu'il ne connaît pas, et le client ignore une colonne en plus (#189).
- Seul le cran N-1 est garanti. Remonter plus loin passe par la restauration.
- Une valeur nouvelle dans une colonne existante échappe au contrôle : elle se signale à la
  publication, et son retour arrière restaure le dump.
