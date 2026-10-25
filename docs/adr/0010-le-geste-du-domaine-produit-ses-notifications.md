---
status: accepted
---

# Notifications : le geste du domaine les produit, l'API les écrit et les envoie sans file

Les destinataires d'une notification relèvent d'une règle du domaine. « Nouvelle partie » va à tout le monde, sauf aux MJ qui mènent sur le créneau et aux joueurs d'une partie double publiée qui l'occupe. Un même geste n'envoie à une personne que la notification la plus précise (NO-1, NO-2). Cette règle vit donc sur l'objet qui détient l'état ([ADR 0005](0005-une-regle-vit-sur-l-objet-qui-recoit-ses-collaborateurs.md)) : le geste du domaine (`moveGame`, `unschedule`, plus tard `publishDraw`) réunit ses notifications. Chacune porte un code, des paramètres, ses destinataires et son échéance, sans texte. La commande les récupère après une sauvegarde réussie et les passe au port `NotificationSender` d'`application`. L'API écrit en français le titre, le corps et l'adresse du tap, avec un catalogue, comme pour les refus ([ADR 0008](0008-le-domaine-donne-un-code-l-api-ecrit-le-message.md)). Puis elle envoie aussitôt, en arrière-plan, sans faire attendre la réponse de l'Organisateur.

## Considered Options

- **Événements du domaine génériques** (`GameMoved`) et un gestionnaire qui calcule les destinataires : le gestionnaire aurait redemandé à la convention qui peut s'inscrire sur le créneau, et la règle « la plus précise » se serait répartie entre plusieurs gestionnaires.
- **File en base (outbox)**, écrite dans la transaction de la sauvegarde : rien ne se perdrait si le serveur redémarre, au prix d'une table et d'une tâche. Écartée : ~80 envois prennent quelques secondes, et les replis existent (bandeau, dernière affectation affichée en premier, annonce orale).
- **Textes écrits par le service worker du front** à partir du code : Safari affiche une notification déclarative sans service worker, donc le texte et l'adresse doivent arriver prêts.
- **`web-push` pour tout l'envoi** : la bibliothèque n'envoie qu'en HTTPS et signe un nouvel en-tête VAPID à chaque envoi, alors qu'Apple demande d'en signer au plus un par heure.

## Consequences

- `changeConvention()` renvoie les notifications de la tentative réussie : une tentative rejouée sur une version périmée n'envoie rien.
- Un destinataire est un pseudo (identifiant interne), jamais un téléphone ; « tout le monde » s'écrit « tout le monde sauf ces pseudos ». L'envoi cherche les téléphones reliés au moment d'envoyer (ID-8).
- L'abonnement push est rangé avec le téléphone relié, hors du domaine. Un endpoint n'appartient qu'à un seul téléphone relié ; il disparaît avec le lien, et un 404 ou un 410 l'efface. L'application le renvoie à chaque ouverture et après chaque liaison, car Safari iOS ne signale pas son renouvellement (`pushsubscriptionchange`).
- Un seul JSON sert les deux formats : Declarative Web Push (`web_push: 8030`, `navigate`) pour Safari 18.4 et plus, `data.onActionClick` pour le service worker d'Angular ailleurs. Les chemins du front office sont donc déclarés dans `contract`, que lisent le routeur et le catalogue.
- `TTL` : le temps qui reste jusqu'à la fin du créneau concerné (le second pour une partie double, NO-3). Une notification échue ne part pas ; tant que la convention n'a pas de date, le `TTL` est de 4 semaines. Le domaine donne l'échéance en heure locale ; l'API la convertit avec le fuseau `Europe/Paris`, fixé dans le code et non réglé sur la convention. `Urgency: high` pour toutes. Les « nouvelle partie » d'un même créneau partagent un `Topic` et un `tag`, et se remplacent sans nouveau son (NO-5).
- `web-push` 3.6.7 ne fait que chiffrer et signer. L'API envoie par `fetch`, 10 requêtes à la fois, avec une seule nouvelle tentative sur 429, 5xx ou erreur réseau, et garde l'en-tête VAPID une heure par service push. La suite e2e de l'API vise un faux service push en HTTP.
- Sans clés VAPID dans l'environnement, rien ne part et la clé publique n'est pas servie : le front affiche le bandeau « push non pris en charge » (NO-6).
