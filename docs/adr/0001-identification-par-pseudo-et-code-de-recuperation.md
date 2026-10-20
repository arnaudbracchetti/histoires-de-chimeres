---
status: accepted
---

# Identification des participants par pseudo et code de récupération

La convention n'a ni billetterie ni inscription préalable : on ne connaît pas les participants à l'avance et on n'a pas leur email. Un participant s'identifie donc sans compte : il accède à l'application en scannant un QR code affiché dans la salle, choisit un pseudo (unique dans la convention), et reçoit un code de récupération qui lui permet de retrouver son identité sur un autre appareil. S'il perd ce code, un Organisateur le retrouve par son pseudo après l'avoir reconnu en personne.

Ce choix est assumé comme une première étape, la plus légère possible ; il pourra évoluer.

## Considered Options

- **Pseudo seul, stocké sur le téléphone** : rejeté, l'identité est perdue au moindre changement de navigateur ou vidage de cache.
- **Lien magique par email, SMS** : impossibles ou trop lourds sans connaître les participants à l'avance.
- **Badges papier avec QR code unique distribués à l'accueil** : plus robuste (identité physique, rescannable) et limite les pseudos en double, mais demande une logistique d'impression. Piste d'évolution privilégiée.
- **Passkeys, connexion Google/Apple/Discord** : identité solide mais friction et coût de développement disproportionnés pour un week-end.

## Consequences

- Rien n'empêche un participant de créer plusieurs pseudos ; on l'accepte, un Organisateur peut supprimer un pseudo suspect.
- Aucun email n'est connu côté participant : les notifications passent par le push web.
- Le modèle d'identité doit rester remplaçable (ex. badges QR) sans toucher au reste du domaine : un participant est identifié par le système, le pseudo n'est qu'un nom affiché.
