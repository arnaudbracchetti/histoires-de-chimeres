---
status: accepted
---

# Le compte du back office : un pseudo et un mot de passe, sans email

Un MJ ou un Organisateur entre dans le back office par son **compte**. Le compte désigne un participant : son pseudo sert d'identifiant de connexion, comparé comme ID-7 (casse, accents, espaces). Le compte porte en plus un mot de passe, haché, et l'indicateur « Organisateur ». Être MJ se lit sur le participant, qui a un `GameMaster` (ADR 0012) : le compte n'a pas d'indicateur MJ. Un Organisateur a donc lui aussi un participant, créé avec son compte : une personne n'a qu'un nom, son pseudo, au back office comme sur le téléphone.

Le compte ne connaît aucun email. Un Organisateur crée un **lien d'accès** et le remet lui-même à la personne (de vive voix, par message). Ce lien ouvre la page où la personne choisit son mot de passe. Elle se connecte ensuite seule, par pseudo et mot de passe. Si elle l'oublie, un Organisateur lui crée un nouveau lien d'accès, qui remplace l'ancien mot de passe.

Le compte est un agrégat à part, rattaché à la convention, hors de l'agrégat `Convention` : la connexion cherche un compte par pseudo sans charger la convention.

Le téléphone ne change pas (ADR 0009) : saisir le pseudo d'un compte relie le téléphone après une confirmation, sans mot de passe, et le téléphone ne donne aucun droit du back office.

## Considered Options

- **Lien magique envoyé par email** (ancienne ID-6) : le MJ se reconnecte seul, sans Organisateur. Écarté : pour 2 ou 3 Organisateurs et une dizaine de MJ, il faut un fournisseur d'envoi, un domaine d'envoi, Mailpit hors production, et stocker des emails, seule donnée nominative de l'application.
- **Lien remis en main propre, sans mot de passe** : chaque nouvel ordinateur, chaque session perdue repasse par un Organisateur. Le mot de passe rend la personne autonome après son premier lien.
- **Un identifiant de connexion distinct du pseudo** : deux noms pour une même personne, dont un qu'elle ne voit nulle part ailleurs.
- **Mot de passe et indicateur sur le participant, sans agrégat Compte** : le participant, partagé avec le téléphone et le tirage, porterait des données propres au back office.
- **Une liste de rôles sur le compte** : le rôle MJ y aurait doublé le lien entre le participant et son `GameMaster`. Seul Organisateur y restait : un indicateur suffit.

## Consequences

- ID-6 et le §6 du PRD changent : aucun email stocké, aucun envoi d'email.
- Le pseudo d'un Organisateur, comme celui d'un MJ, est connu : le mot de passe est le seul secret du back office.
- Renommer le pseudo d'un compte (ID-13) change son identifiant de connexion.
- Supprimer ou fusionner le pseudo d'un compte, retirer un rôle, et l'ergonomie de création d'un compte de MJ (qui crée le MJ du même geste) relèvent de la gestion des comptes.
