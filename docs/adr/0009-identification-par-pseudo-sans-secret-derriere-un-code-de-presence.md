---
status: accepted
---

# Identification par pseudo sans secret, derrière un code de présence

Remplace l'[ADR 0001](0001-identification-par-pseudo-et-code-de-recuperation.md). Le participant s'identifie par son seul pseudo : s'il est nouveau, il est créé ; s'il existe, l'application demande « Ce pseudo existe déjà. Est-ce bien toi qui l'as créé ? », et le téléphone y est relié sur un « oui ». Le pseudo n'est pas un secret : quiconque le connaît peut le reprendre. On l'accepte, car l'enjeu est faible (des inscriptions à des parties, une journée) et le code de récupération ne protégeait pas mieux : un Organisateur devait le redonner à qui le demandait, sans pouvoir reconnaître une personne qu'il ne connaît pas. La protection porte sur le lieu, pas sur la personne : sans le **code de présence**, que transmet le QR code affiché sur place, le serveur refuse toute identification. Les pseudos des MJ, publics puisqu'ils figurent sur les fiches de partie, demandent en plus le code MJ.

## Considered Options

- **Pseudo + code de récupération** (ADR 0001) : un code à noter pour chacun, perdu ou mal recopié, et contournable par l'Organisateur. Sur iPhone, il fallait le retaper dans la web app de l'écran d'accueil, dont le stockage est séparé de Safari ; retaper son pseudo suffit désormais.
- **Code de présence exigé à chaque requête** : la web app iPhone, qui ne partage pas le stockage de Safari, risquait d'être bloquée dès sa première ouverture. Le code n'ouvre que l'identification ; la session suffit ensuite.
- **Plusieurs pseudos sur un même téléphone, chacun notifié** : utile à deux personnes qui partagent un téléphone, mais le besoin est seulement de pouvoir les inscrire toutes deux. Un téléphone est relié à un seul pseudo à la fois.
- **Badges QR, passkeys** : restent des pistes d'évolution (PRD §7).

## Consequences

- La session est un cookie `HttpOnly` posé par le serveur, qui relie le téléphone à un pseudo, sans expiration propre : la plage d'accès fait foi. Elle désigne le participant par son identifiant interne ; un badge QR remplacerait la saisie du pseudo sans toucher au reste.
- Un pseudo peut être relié à plusieurs téléphones. « Changer de pseudo » coupe le lien du téléphone ; l'ancien pseudo reste, avec ses inscriptions. Les notifications vont au pseudo relié au téléphone au moment de l'envoi.
- Deux personnes de bonne foi qui veulent le même pseudo ne fusionnent pas : la seconde répond « non » à la confirmation et en choisit un autre. Une personne de mauvaise foi peut reprendre un pseudo ; un Organisateur corrige sur place.
- Le code de présence est fixé à la création de la convention et ne change pas : s'il fuit, on l'accepte. Il ne remplace ni la plage d'accès ni le code d'accès anticipé.
