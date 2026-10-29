-- Vide toutes les tables, sauf l'historique des migrations. Suivi de la migration
-- default_convention, puis de restore-presence-code.sql, il ramène une base de test à son état de
-- migration. Le code de présence ne change jamais : il est gardé le temps de la transaction.
DO $$
DECLARE
  t text;
BEGIN
  CREATE TEMP TABLE kept_presence_code ON COMMIT DROP AS SELECT "presenceCode" FROM "Convention";
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
  END LOOP;
END $$;
