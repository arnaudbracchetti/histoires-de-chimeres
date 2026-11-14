# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Participant** : vient jouer à la convention, inconnu à l'avance. Sur son téléphone, sur place, en 4G/5G, souvent debout et pressé. Il s'inscrit aux parties, puis apprend sa table.
- **MJ** : propose ses scénarios et ses disponibilités dans le back office avant la convention. Le jour J, sur son téléphone, il suit les parties qu'il mène et leurs joueurs. Il est aussi participant.
- **Organisateur** : membre de l'association. Prépare la convention dans le back office sur ordinateur, puis la pilote le jour J (surcharge, tirage, ajustements, publication).

Une personne, un compte : un MJ est un participant, et une même personne peut être MJ et Organisateur (ADR 0012).

## Product Purpose

Inscription et tirage au sort des parties d'une convention de jeu de rôle d'une journée, organisée par l'association « Les tisseurs de chimères ». Réussir, c'est : chaque participant inscrit sur un créneau joue ; les tables sont brassées ; chacun apprend sa table sur son téléphone dès la publication du tirage. Besoin complet : `docs/prd.md`.

## Positioning

Ce qu'un tableur ou un outil d'inscription générique ne fait pas :

- **Le tirage** : un ordre de priorités strict (TI-4) pour que chaque inscrit joue, avec le brassage des tables et les parties doubles (TI-3).
- **Zéro friction** : ni compte ni email, un pseudo derrière le code de présence, sur son téléphone, sur place. Une expérience simple et fluide dans le front office.
- **La notification de table** : chacun l'apprend dès la publication, et la retrouve hors ligne.
- **Le pilotage du jour J** : une vue synthétique de la journée et de l'état des inscriptions, créneau par créneau, pour décider d'ajouter ou de retirer des parties selon le nombre de présents.

## Operating Context

- Convention d'une journée : 25 à 80 participants, 4 ou 5 créneaux de 2 h 30, 3 à 5 parties par créneau.
- Réseau mobile seul sur place, pas de Wi-Fi. Programme et situation du participant consultables hors ligne.
- Entrée par le QR code de l'affiche ou de l'écran d'accueil, qui porte le code de présence.
- iPhone : notifications seulement après ajout à l'écran d'accueil (iOS 16.4+).
- Les Organisateurs annoncent aussi chaque publication à voix haute.

## Capabilities and Constraints

- Deux fronts : front office (PWA mobile, participants et MJ) et back office (ordinateur, MJ et Organisateurs, `/gestion/`). Pile : Angular, NestJS, Prisma/PostgreSQL (voir CLAUDE.md).
- Vocabulaire : GLOSSARY.md fait foi, interface comprise ; ses termes _Avoid_ sont exclus.
- Aucune donnée nominative, aucun email stocké ni envoyé. Français seul, heure de Paris.
- Hors V1 : `docs/prd.md` §7. Points ouverts : §8 (aucun pour l'instant), à soumettre à l'utilisateur, jamais à trancher.

## Brand Commitments

- Nom : « Histoires de Chimères ». L'association apparaît par son nom (« par les Tisseurs de Chimères »), pas par son logo.
- Identité, ton et patterns : la charte `docs/design/` fait foi (thème sombre seul, tutoiement, typographie française).
- Référence visuelle : l'affiche de la convention de l'an dernier, sur le compte Instagram de l'association (https://www.instagram.com/tisseursdechimeres/). La charte la nomme « affiche de la Convention 2026 ».

## Evidence on Hand

- Besoin : `docs/prd.md` ; décisions : `docs/adr/` ; charte : `docs/design/`.
- Éléments graphiques dans `packages/design/svg/` : `emblem.svg` (emblème), `illustration.svg` (motif gravé de l'illustration par défaut), `icons.svg` (sprite d'icônes, dessins Lucide, licence dans `LICENSE-lucide.txt`).
- L'affiche se consulte sur Instagram ; aucun fichier de l'affiche ni vecteur du logo de l'association dans le dépôt : ne pas les inventer.
- Aucun témoignage ni chiffre de fréquentation réel.

## Product Principles

1. Chaque inscrit joue : le tirage passe avant toute autre considération.
2. Zéro friction pour le participant : un pseudo, un téléphone, rien d'autre.
3. Fiable sur un réseau faible : léger, consultable hors ligne, jamais de geste perdu en silence.
4. Le jour J, l'Organisateur voit d'un coup d'œil ce qui se passe et peut agir.
5. Les mots du glossaire, partout.

## Accessibility & Inclusion

WCAG 2.2 AA, vérifié pendant le développement, sans audit. Détail : `docs/design/identite.md` (contrastes, clavier, cibles de 44 px, pas d'info par la couleur seule, `prefers-reduced-motion`).
