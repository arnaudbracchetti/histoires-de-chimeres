-- Vide toutes les tables, sauf l'historique des migrations. Suivi de la migration
-- default_convention, puis de restore-presence-code.sql, il ramène une base de test à son état de
-- migration. Le code de présence ne change jamais : il est gardé le temps de la transaction.
DO $$
BEGIN
  CREATE TEMP TABLE kept_presence_code ON COMMIT DROP AS SELECT "presenceCode" FROM "Convention";
  -- Un seul TRUNCATE pour toutes les tables : 25 ms, contre 300 ms pour un TRUNCATE CASCADE par
  -- table, qui repasse à chaque fois sur toutes les tables liées.
  EXECUTE (
    SELECT 'TRUNCATE TABLE ' || string_agg(format('%I', tablename), ', ')
    FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
  );
END $$;
