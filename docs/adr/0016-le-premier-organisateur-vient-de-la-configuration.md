---
status: accepted
---

# Le premier Organisateur vient de la configuration du déploiement

Deux variables d'environnement, `ORGANIZER_PSEUDO` et `ORGANIZER_PASSWORD`, rangées dans les secrets du déploiement, donnent un compte Organisateur. Au démarrage, l'API s'assure que ce pseudo a un compte Organisateur avec ce mot de passe. Elle crée le participant si le pseudo n'existe pas, et ajoute le compte au participant s'il existe déjà (ADR 0012, pseudo comparé comme ID-7). La personne se connecte tout de suite, sans lien d'accès.

La valeur ne s'applique **qu'une fois**. L'API garde en base l'empreinte SHA-256 du couple pseudo + mot de passe déjà appliqué. Au démarrage suivant, si la valeur n'a pas changé, elle ne fait rien : l'Organisateur garde le mot de passe qu'il a choisi depuis. Le jour où plus aucun Organisateur ne peut entrer, on change le secret et on redéploie. La nouvelle valeur s'applique une fois : le compte devient Organisateur s'il ne l'est pas, son mot de passe est remplacé et toutes ses sessions sont fermées, comme pour un lien d'accès. C'est la seule porte de secours.

Le mot de passe est en clair dans la variable. Il vit au même endroit que `DATABASE_URL`, qui donne déjà tous les droits.

Sans ces deux variables, l'API ne fait rien. Avec une seule des deux, un pseudo vide ou un mot de passe refusé par les règles du compte, elle refuse de démarrer : le healthcheck échoue et le déploiement revient à la version précédente.

Un Organisateur ne peut ni se retirer lui-même le rôle d'Organisateur, ni supprimer son propre compte. Il peut le faire pour un autre Organisateur. Il reste donc toujours au moins un Organisateur, sans compter les comptes.

## Considered Options

- **Une commande dans l'image qui affiche un lien d'accès** : le lien doit être récupéré puis suivi par une personne. Un déploiement automatique ne peut pas le faire.
- **La première visite du back office crée le premier Organisateur** : le domaine est public, et la première personne qui arrive prend la place.
- **Une migration** : elle ne peut remettre ni lien ni mot de passe à la personne.
- **Appliquer la variable à chaque démarrage** : chaque déploiement écraserait le mot de passe choisi par l'Organisateur.
- **Un hachage scrypt dans la variable** : il complique le secours et ne protège rien de plus.

## Consequences

- La base garde l'empreinte de la dernière valeur appliquée.
- Les suites de bout en bout n'utilisent pas ces variables : la remise à zéro de leur base efface ce compte. Elles insèrent leur propre session (ADR 0020).
