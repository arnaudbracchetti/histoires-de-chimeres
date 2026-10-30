---
status: accepted
---

# Le front office lit ses données par un seul module, qui relit toutes les 30 s

Le programme et la situation du participant (ses inscriptions, ses affectations, les parties qu'il mène) doivent rester frais quand le réseau passe, et lisibles quand il manque (§6). Les règles qui le permettent sont nombreuses : relire toutes les 30 s quand la page est visible, et au retour au premier plan ; garder la dernière donnée si une lecture échoue ; dire l'âge de la donnée ; cacher les créneaux terminés et fermer l'application à la fin de la convention, selon l'heure du téléphone ; signaler ce qui change pour le participant ; oublier les données d'un pseudo quittant le téléphone. Un seul module du front office, `ParticipantData`, les applique toutes, sauf la dernière : l'oubli vit dans `LinkedPhone`, qui sait quand le pseudo quitte le téléphone, même hors de la coquille (lien coupé constaté à l'ouverture). `ParticipantData` lui signale le lien coupé qu'une relecture découvre. Les écrans lisent ses signaux et lui confient leurs gestes (s'inscrire, se désinscrire) ; ils n'appellent jamais l'API eux-mêmes pour ces données. Quand le module relit, Angular redessine les écrans concernés : un écran ne demande jamais de nouvelles données.

## Considered Options

- **Chaque écran lit l'API** par `apiResource()` : les règles ci-dessus se seraient copiées dans l'Accueil, le Programme, Mes parties et la fiche.
- **Flux SSE** qui signale les changements, suivi d'une relecture : Android coupe le flux quelques secondes après le passage en arrière-plan (et l'iPhone probablement aussi) ; le tirage ignore l'ordre des inscriptions, donc la seconde près ne sert à rien ; il faudrait une source d'événements dans l'API, et un 502 pendant un redéploiement arrête `EventSource` pour de bon. Google Read-Aloud, qui exécute les pages ouvertes par un QR code ou une notification, ouvrirait aussi des flux.
- **WebSocket** : mêmes limites en arrière-plan, deux paquets de plus et une reconnexion à écrire, pour un besoin à sens unique.
- **Le push pour rafraîchir** : un push doit toujours afficher une notification, et une notification déclarative de Safari n'atteint pas la page (`SwPush.messages` n'émet rien). Le push reste un déclencheur de relecture sur Android, pas une source de données.
- **File d'attente des inscriptions hors ligne** : l'iPhone n'a pas Background Sync, et une inscription rejouée après le lancement du tirage serait refusée alors que le participant se croyait inscrit.

## Consequences

- Toutes les lectures JSON du front office passent par un seul `dataGroup` en `freshness`, avec un `timeout` de 3 s et un `maxAge` de 30 jours : le code de présence ouvre l'application à toute heure, et un programme chargé plusieurs jours avant doit rester lisible. Une erreur HTTP n'est pas servie depuis le cache : le module garde alors la dernière donnée. Si un DTO change de forme, la `version` du `dataGroup` augmente. Quand le pseudo quitte le téléphone, `OfflineCopy` efface de ce cache les lectures propres au pseudo ; celle de la convention reste.
- Le programme porte tout le contenu des fiches : une fiche est lisible hors ligne dès que le programme a été lu une fois. Les images ne sont pas préchargées.
- L'âge d'une donnée vient de l'en-tête `Date`, que le cache du service worker garde. Le serveur n'ajoute rien.
- Le serveur donne l'heure de fin de chaque créneau et de la convention ; le module la compare à l'heure du téléphone, sans recalculer la règle du domaine.
- L'alerte de changement naît de la comparaison de deux lectures de la situation du participant, et non du push : elle marche sur iPhone et sur un téléphone sans notifications (NO-6).
- La relecture toutes les 30 s attend que l'application soit stable (`ApplicationRef.isStable`), sinon l'enregistrement du service worker est retardé (`registerWhenStable`).
- S'inscrire et se désinscrire sont sans effet si on les répète (IN-2) : après un délai sans réponse, le participant réessaie sans risque.
- La mise à jour de l'application vit dans un petit module à part, `AppUpdate`, branché sur la même détection du premier plan.
- L'horloge et la visibilité de la page entrent dans le module par injection : il se teste seul, par son interface.
