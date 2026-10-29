-- Code de présence (ID-2) : 4 caractères parmi 31, majuscules et chiffres sans 0, O, 1, I ni L.
-- Les octets viennent de gen_random_uuid(), tirés par un générateur sûr ; les 4 premiers sont
-- entièrement aléatoires. La valeur par défaut de la colonne donne son code à la convention
-- existante, et à celle que crée la migration default_convention dans une base vide.
CREATE FUNCTION random_presence_code() RETURNS text
LANGUAGE sql VOLATILE
AS $$
  SELECT string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(bytes, i) % 31, 1),
    '' ORDER BY i
  )
  FROM (SELECT uuid_send(gen_random_uuid()) AS bytes) AS random, generate_series(0, 3) AS i
$$;

-- AlterTable
ALTER TABLE "Convention" ADD COLUMN "presenceCode" TEXT NOT NULL DEFAULT random_presence_code();
