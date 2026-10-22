---
status: accepted
---

# Les images de scénario sont stockées en base, en une seule déclinaison WebP

L'API traite chaque image de scénario envoyée avec sharp. Elle la recadre au centre en 3:2, la réduit à 1200 × 800 px au plus sans l'agrandir, applique l'orientation EXIF, retire les métadonnées et l'encode en WebP (q80, environ 85 Ko). Seule cette déclinaison est gardée : ni l'original, ni une vignette. La vignette carrée et le bandeau en dérivent par recadrage CSS. L'image est stockée dans PostgreSQL (`bytea`), dans une table à part du scénario, pour que les listes de scénarios ne chargent jamais les octets. Chaque envoi crée une image d'identifiant neuf, servie par une URL immuable (`Cache-Control: max-age=31536000, immutable`). Remplacer l'image change l'URL, et l'ancienne image est supprimée.

Chaque convention repart d'une base vide, et le volume reste de quelques Mo par convention. La base suffit donc. Elle donne une seule sauvegarde (`pg_dump`), une seule remise à zéro, et un scénario et son image écrits dans la même transaction. Faits et mesures : `docs/research/images-de-scenario.md`.

## Considered Options

- **Volume Docker** : des fichiers statiques simples à servir, mais une deuxième sauvegarde, une deuxième purge, des fichiers orphelins possibles, et un dossier à créer et à donner à `node` dans le Dockerfile.
- **Stockage objet compatible S3** : un service, des secrets et un SDK de plus pour quelques Mo. Les images viendraient d'une autre origine, dont les réponses opaques compliquent le cache du service worker.
- **AVIF** : environ 40 % plus léger que WebP, mais 4 s d'encodage par image, ce qui demanderait un traitement différé.
- **Plusieurs tailles, ou l'original gardé** : plus de stockage, de code et d'entrées en cache. Les vignettes ne servent que dans le back office, sur ordinateur.

## Consequences

- Pour le domaine, l'image n'est qu'une référence opaque portée par `Scenario`. Le traitement (sharp) et le dépôt des octets sont des ports de `application`, implémentés dans `apps/api`.
- L'image a ses propres endpoints sous le scénario (envoi en multipart, retrait, lecture), à part du DTO JSON du scénario. Ce sont les seuls endpoints qui sortent du modèle `endpoint<Dto>` (ADR 0004).
- Une URL ne change jamais de contenu : aucun `ETag`, aucune revalidation, et le service worker du front office peut toujours servir l'image depuis son cache.
- Changer les réglages de traitement ne concerne que les images envoyées ensuite : rien n'est conservé pour régénérer les anciennes.
