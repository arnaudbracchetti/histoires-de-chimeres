---
status: accepted
---

# Identification par pseudo sans secret, derrière un code de présence

Remplace l'[ADR 0001](0001-identification-par-pseudo-et-code-de-recuperation.md). Le participant s'identifie par son seul pseudo : s'il est nouveau, il est créé ; s'il existe, l'application demande « Ce pseudo existe déjà. Est-ce bien toi qui l'as créé ? », et le téléphone y est relié sur un « oui ». Le pseudo n'est pas un secret : quiconque le connaît peut le reprendre. On l'accepte, car l'enjeu est faible (des inscriptions à des parties, une journée) et le code de récupération ne protégeait pas mieux : un Organisateur devait le redonner à qui le demandait, sans pouvoir reconnaître une personne qu'il ne connaît pas. La protection porte sur le lieu, pas sur la personne : sans le **code de présence**, que transmet le QR code affiché sur place, le serveur refuse toute identification. Le pseudo d'un MJ, donné par un Organisateur et public puisqu'il figure sur les fiches de partie, suit la même règle : le saisir relie le téléphone à ce MJ, après une confirmation propre aux MJ, sans code.

## Considered Options

- **Pseudo + code de récupération** (ADR 0001) : un code à noter pour chacun, perdu ou mal recopié, et contournable par l'Organisateur. Sur iPhone, il fallait le retaper dans la web app de l'écran d'accueil, dont le stockage est séparé de Safari ; retaper son pseudo suffit désormais.
- **Code de présence exigé à chaque requête** : la web app iPhone, qui ne partage pas le stockage de Safari, risquait d'être bloquée dès sa première ouverture. Le code n'ouvre que l'identification ; la session suffit ensuite.
- **Plusieurs pseudos sur un même téléphone, chacun notifié** : utile à deux personnes qui partagent un téléphone, mais le besoin est seulement de pouvoir les inscrire toutes deux. Un téléphone est relié à un seul pseudo à la fois.
- **Code MJ** : un code personnel, demandé en plus quand on saisit le pseudo d'un MJ, aurait protégé ces pseudos publics. Écarté en V1 : l'enjeu reste faible, et le code peut s'ajouter plus tard sans toucher au reste.
- **Pseudo attaché au téléphone qui l'a créé** : le reprendre depuis un autre téléphone passerait par un Organisateur. Une page web ne lit aucun identifiant matériel ; le seul possible est un cookie, perdu en même temps que la session, et sur iPhone, Safari et la web app de l'écran d'accueil comptent pour deux téléphones. Chaque session perdue mènerait à un Organisateur, qui ne peut pas reconnaître un participant qu'il ne connaît pas.
- **Verrouiller un pseudo après une usurpation** : plus aucune liaison, sauf par un geste d'un Organisateur. Écarté : ce serait un code sous un autre nom, pour un enjeu qui reste faible.
- **Plage d'accès et code d'accès anticipé** : le front office n'aurait ouvert qu'à une heure fixée par un Organisateur, et un second code, modifiable, aurait laissé entrer plus tôt ceux qui testent le parcours. Écarté : le QR code porte le code de présence, donc l'heure d'ouverture ne protégeait que d'une fuite du code avant la convention, alors que le tirage ignore l'ordre des inscriptions. Un testeur devait en outre saisir les deux codes.
- **Badges QR, passkeys, code MJ** : restent des pistes d'évolution (PRD §7).

## Consequences

- La session est un cookie `HttpOnly` posé par le serveur, qui relie le téléphone à un pseudo pendant 30 jours : le code de présence ouvre l'application bien avant le jour J. La fin de la convention ferme tout, cookie ou non. Elle désigne le participant par son identifiant interne ; un badge QR remplacerait la saisie du pseudo sans toucher au reste.
- Un pseudo peut être relié à plusieurs téléphones. « Changer de pseudo » coupe le lien du téléphone ; l'ancien pseudo reste, avec ses inscriptions, qui ne passent sur un autre pseudo que par une fusion décidée par un Organisateur. Les notifications vont au pseudo relié au téléphone au moment de l'envoi.
- Deux personnes de bonne foi qui veulent le même pseudo ne se retrouvent pas dessus : la seconde répond « non » à la confirmation et en choisit un autre. Une personne de mauvaise foi peut reprendre un pseudo, y compris celui d'un MJ. Un Organisateur corrige sur place : il coupe tous les liens du pseudo, sans le verrouiller, et règle la suite avec les personnes (PRD ID-5).
- Le pseudo d'un MJ est unique dans toute la convention : un participant qui le saisit est relié au MJ, et un Organisateur ne peut pas donner à un MJ un pseudo déjà pris par un participant.
- Le code de présence est fixé à la création de la convention et ne change pas : s'il fuit, on l'accepte, même avant la convention, où il laisse s'inscrire depuis chez soi. C'est le seul code du front office : il fait entrer à toute heure, et un Organisateur le donne avant le jour J à ceux qui testent le parcours. Seule la fin de la convention, à la fin de son dernier créneau, ferme le front office, pour tous.
