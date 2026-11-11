---
status: accepted
---

# Un lien d'accès de 7 jours qui remet le compte à zéro, un mot de passe sans blocage du compte

Le niveau de sécurité visé est modeste. Le mot de passe reste pourtant le seul secret du back office, car les pseudos sont connus de tous (ADR 0015).

**Lien d'accès.** Il est valable 7 jours et ne sert qu'une fois. Un compte n'a qu'un lien valable : en créer un nouveau annule le précédent. Le jeton fait 256 bits ; la base n'en garde que le SHA-256 et la date d'expiration ([recherche](../research/lien-magique.md)). **Créer un lien d'accès remet le compte à zéro** : le mot de passe est effacé et toutes les sessions du compte sont fermées, tout de suite. Le `GET` du lien affiche seulement le formulaire du mot de passe, et c'est le `POST` qui l'utilise : l'aperçu de lien d'une messagerie ne le consomme pas. Une fois le mot de passe choisi, la personne est connectée.

**Mot de passe.** Il fait de 10 à 128 caractères, sans règle de composition ; les espaces sont acceptés, et le pseudo lui-même est refusé. Il est haché par `scrypt` de `node:crypto`, derrière le port `PasswordHasher` d'`application`. L'agrégat `Account` porte le hachage, le lien en cours, et les règles « lien expiré ou déjà utilisé » et « mot de passe trop court ».

**Essais de connexion.** On ne bloque jamais le compte. On limite le débit : 5 essais par minute pour un couple (IP, pseudo), 30 par minute pour une IP, puis 429. Les compteurs restent en mémoire, car l'application tourne en une seule instance.

## Considered Options

- **Un lien de 24 h au plus**, comme le recommandent les règles de récupération par email : le lien est remis de la main à la main, avant la convention, et un MJ ne l'ouvre pas forcément le jour même.
- **Un lien qui laisse le mot de passe en place jusqu'à son usage** : il ne couperait pas un compte volé. Remettre le compte à zéro fait du lien d'accès le geste de secours.
- **Une page intermédiaire avant le formulaire** : le formulaire joue déjà ce rôle.
- **Bloquer le compte après N échecs** : le pseudo d'un Organisateur étant connu, n'importe qui pourrait le bloquer le jour J.
- **Argon2 ou bcrypt** : une dépendance native de plus dans l'image, pour un gain sans intérêt à ce niveau.
- **Des compteurs en base ou dans Redis** : utiles seulement à plusieurs instances.

## Consequences

- Passer à plusieurs instances oblige à déplacer les compteurs de la limite des essais.
- Le 429 ne se teste que dans la suite HTTP, avec un limiteur injecté et une horloge contrôlée (ADR 0020).
