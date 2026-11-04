-- POUR LES TESTS SEULEMENT, à supprimer avec la fonctionnalité.
--
-- Annule la publication du dernier tirage publié : il redevient provisoire, avec ses affectations
-- et ses parties annulées, et se publie de nouveau depuis le back office. Le tirage d'un créneau
-- suivant, forcément provisoire, est supprimé : ses inscriptions se rouvrent, comme après
-- « Rouvrir les inscriptions ». Sinon il garderait de côté les joueurs d'une partie double qui
-- n'est plus publiée (TI-3). Aucune notification ne part.
--
-- Se lance par scripts/unpublish-last-draw.sh.

BEGIN;

CREATE TEMP TABLE last_published ON COMMIT DROP AS
SELECT d."timeSlotId", t."conventionId", t."startMinute"
FROM "Draw" d
JOIN "TimeSlot" t ON t.id = d."timeSlotId"
WHERE d.published
ORDER BY t."startMinute" DESC
LIMIT 1;

-- Les tirages des créneaux suivants (affectations et parties annulées partent en cascade).
DELETE FROM "Draw" d
USING "TimeSlot" t, last_published l
WHERE t.id = d."timeSlotId"
  AND t."conventionId" = l."conventionId"
  AND t."startMinute" > l."startMinute";

UPDATE "Draw" d
SET published = false
FROM last_published l
WHERE d."timeSlotId" = l."timeSlotId";

-- Une commande en cours sur l'ancienne version rejouera sur la nouvelle.
UPDATE "Convention" c
SET version = version + 1
FROM last_published l
WHERE c.id = l."conventionId";

SELECT CASE WHEN count(*) = 0 THEN 'Aucun tirage publié : rien à faire.'
            ELSE 'Publication annulée.' END AS resultat
FROM last_published;

COMMIT;
