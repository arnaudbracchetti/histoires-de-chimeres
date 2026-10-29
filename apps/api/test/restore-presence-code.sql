-- Rend à la convention recréée par default_convention le code de présence gardé par
-- reset-database.sql : un test qui l'a lu le garde valable, même si une remise à zéro passe entre-temps.
UPDATE "Convention" SET "presenceCode" = kept."presenceCode" FROM kept_presence_code AS kept;
