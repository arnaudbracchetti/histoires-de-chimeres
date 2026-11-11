---
status: accepted
---

# Les tests entrent dans le back office sans porte de connexion

L'API n'a aucune route ni aucun drapeau qui n'existe que pour les tests. Les tests utilisent le vrai cookie de session, mis en place par les données.

Après la remise à zéro de la base, la fixture Playwright insère en SQL un compte Organisateur au pseudo fixe et une session dont le jeton est une constante des tests (la base n'en garde que le SHA-256). Elle pose ensuite le cookie dans le contexte par `addCookies`. Le projet `mobile`, dont la base n'est jamais remise à zéro, appelle la même fonction, qui ne crée le compte et la session que s'ils manquent. La suite HTTP fait de même, et son helper renvoie l'en-tête `Cookie`. Un MJ obtient sa session par le vrai parcours : l'Organisateur lui crée un lien d'accès, et le test y choisit un mot de passe. Un seul parcours Playwright passe par la vraie connexion : lien d'accès, mot de passe, déconnexion, reconnexion. Les helpers d'écriture ajoutent `Origin` (Playwright) ou `Sec-Fetch-Site: same-origin` (supertest) pour passer le garde CSRF (ADR 0019).

## Considered Options

- **Une route de connexion réservée aux tests** : si elle restait active en production par erreur, ce serait une faille.
- **Se connecter avant chaque test** : le projet `bureau` dépasserait la limite de 30 essais par minute pour une IP (ADR 0018).
- **Se connecter une fois et garder le cookie (`storageState`)** : la remise à zéro avant chaque test efface la session.
- **L'Organisateur de `ORGANIZER_PSEUDO` (ADR 0016)** : il n'est créé qu'au démarrage, et la remise à zéro l'efface.

## Consequences

- La fixture connaît les tables du compte et de la session : si elles changent, la fixture casse tout de suite.
- En dev, l'Organisateur vient d'une paire `ORGANIZER_PSEUDO` / `ORGANIZER_PASSWORD` connue, dans `apps/api/.env.example`. La démo suit les règles de la production : aucun mot de passe connu, des liens d'accès au besoin.
