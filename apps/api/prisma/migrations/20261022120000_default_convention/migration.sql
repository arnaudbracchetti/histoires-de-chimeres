-- La convention existe toujours : on la crée, avec un nom provisoire, dans toute base qui n'en a pas.
-- La remise à zéro des bases de test rejoue ce fichier (test/database.ts, e2e/fixtures.ts).
INSERT INTO "Convention" ("id", "name")
SELECT gen_random_uuid(), 'Histoires de Chimères'
WHERE NOT EXISTS (SELECT 1 FROM "Convention");
