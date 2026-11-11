---
status: accepted
---

# La session du back office en base, et un garde CSRF par `Sec-Fetch-Site`

La session du back office est un identifiant opaque de 256 bits, porté par un cookie `__Host-`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`, distinct de `linked-phone`. La base n'en garde que le SHA-256. Un nouvel identifiant est créé à chaque connexion. Le serveur ferme la session après 7 jours d'inactivité, et dans tous les cas 30 jours après la connexion. Elle n'appartient pas au domaine : c'est un mécanisme de l'API (une table et un port), nommé `AccountSession` dans le code, et remplaçable comme l'identification du téléphone (ADR 0009).

Toutes les sessions d'un compte sont fermées quand on lui crée un lien d'accès (ADR 0018) et quand on lui retire son compte. Quand la personne change elle-même son mot de passe, ses autres sessions sont fermées. « Se déconnecter », en bas du rail, supprime la session en base.

Contre le CSRF, un garde global de NestJS refuse les `POST`, `PUT`, `PATCH` et `DELETE` dont `Sec-Fetch-Site` n'est pas `same-origin`. En repli, quand l'en-tête manque, il compare `Origin` au domaine public. Il protège les deux fronts, `linked-phone` compris. Il n'y a pas de jeton XSRF.

## Considered Options

- **Un jeton signé (JWT) sans état côté serveur** : on ne pourrait pas fermer une session tout de suite. Or un lien d'accès doit couper un compte volé, et un rôle retiré doit prendre effet à la requête suivante (ADR 0017).
- **Le couple `XSRF-TOKEN` / `X-XSRF-TOKEN` d'Angular** : un cookie et un en-tête de plus pour un résultat équivalent. OWASP et l'ASVS acceptent `Sec-Fetch-Site` avec repli sur `Origin` ([recherche](../research/lien-magique.md)).
- **Se reposer sur `SameSite=Strict` seul** : OWASP ne le juge pas suffisant, et `linked-phone` n'est pas `Strict`.

## Consequences

- Un client qui n'est pas un navigateur doit envoyer `Origin` ou `Sec-Fetch-Site: same-origin` pour écrire. Les helpers des tests le font (ADR 0020).
- Sur `http://localhost`, Chrome et Firefox acceptent le cookie `Secure`, mais pas Safari.
