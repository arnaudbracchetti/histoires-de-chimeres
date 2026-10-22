-- Vide toutes les tables, sauf l'historique des migrations. Suivi de la migration
-- default_convention, il ramène une base de test à son état de migration.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
  END LOOP;
END $$;
