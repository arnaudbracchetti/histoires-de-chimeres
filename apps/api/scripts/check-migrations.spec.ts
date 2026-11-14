import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUndeclaredDestructiveMigrations } from './check-migrations.js';

const reference = '20270101000000_premier_deploiement';

let migrationsDir: string;

function addMigration(name: string, sql: string): void {
  mkdirSync(join(migrationsDir, name));
  writeFileSync(join(migrationsDir, name, 'migration.sql'), sql);
}

beforeEach(() => {
  migrationsDir = mkdtempSync(join(tmpdir(), 'migrations-'));
});

afterEach(() => {
  rmSync(migrationsDir, { recursive: true, force: true });
});

describe('contrôle des migrations destructives', () => {
  it('accepte une migration additive', () => {
    addMigration(
      '20270201000000_ajout',
      'ALTER TABLE "Game" ADD COLUMN "note" TEXT;\nCREATE INDEX "Game_note_idx" ON "Game"("note");\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([]);
  });

  it('refuse un DROP COLUMN', () => {
    addMigration('20270201000000_suppression', 'ALTER TABLE "Game" DROP COLUMN "note";\n');

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_suppression',
    ]);
  });

  it('accepte un DROP déclaré « -- incompatible : <raison> »', () => {
    addMigration(
      '20270201000000_suppression',
      '-- incompatible : la colonne note disparaît avec la fonction\nALTER TABLE "Game" DROP COLUMN "note";\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([]);
  });

  it('refuse « -- incompatible » sans raison', () => {
    addMigration(
      '20270201000000_suppression',
      '-- incompatible :\nALTER TABLE "Game" DROP COLUMN "note";\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_suppression',
    ]);
  });

  it('ignore une migration destructive antérieure ou égale à la référence', () => {
    addMigration('20261201000000_ancienne', 'ALTER TABLE "Game" DROP COLUMN "note";\n');
    addMigration(reference, 'DROP TABLE "Draft";\n');

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([]);
  });

  it('refuse un RENAME', () => {
    addMigration(
      '20270201000000_renommage',
      'ALTER TABLE "Game" RENAME COLUMN "note" TO "comment";\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_renommage',
    ]);
  });

  it('refuse un changement de type de colonne', () => {
    addMigration(
      '20270201000000_type',
      'ALTER TABLE "Game" ALTER COLUMN "seats" SET DATA TYPE BIGINT;\n',
    );
    addMigration(
      '20270202000000_type_court',
      'ALTER TABLE "Game" ALTER COLUMN "seats" TYPE BIGINT;\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_type',
      '20270202000000_type_court',
    ]);
  });

  it('refuse un changement de type écrit sans COLUMN', () => {
    addMigration('20270201000000_type', 'ALTER TABLE "Game" ALTER "seats" TYPE BIGINT;\n');

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_type',
    ]);
  });

  it('refuse un DROP placé après une chaîne qui contient « -- »', () => {
    addMigration(
      '20270201000000_chaine',
      'UPDATE "Game" SET "note" = \'a--b\'; DROP TABLE "Draft";\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_chaine',
    ]);
  });

  it('refuse un DROP dont la déclaration « incompatible » est dans un bloc /* */', () => {
    addMigration('20270201000000_bloc', '/*\n-- incompatible : cachée\n*/\nDROP TABLE "Draft";\n');

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_bloc',
    ]);
  });

  it('accepte « -- incompatible » avec une espace insécable devant « : »', () => {
    addMigration(
      '20270201000000_suppression',
      '-- incompatible\u00a0: la colonne note disparaît\nALTER TABLE "Game" DROP COLUMN "note";\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([]);
  });

  it('refuse un SET NOT NULL', () => {
    addMigration(
      '20270201000000_obligatoire',
      'ALTER TABLE "Game" ALTER COLUMN "note" SET NOT NULL;\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([
      '20270201000000_obligatoire',
    ]);
  });

  it('accepte une valeur ajoutée à une énumération', () => {
    addMigration('20270201000000_enum', 'ALTER TYPE "DrawStatus" ADD VALUE \'ARCHIVED\';\n');

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([]);
  });

  it('ignore un ordre destructif cité dans un commentaire', () => {
    addMigration(
      '20270201000000_commentaire',
      '/*\n  Warnings:\n  - DROP COLUMN "note" was considered.\n*/\n-- RENAME plus tard\nALTER TABLE "Game" ADD COLUMN "note" TEXT;\n',
    );

    expect(findUndeclaredDestructiveMigrations(migrationsDir, reference)).toEqual([]);
  });

  it('sort en erreur avec la liste des migrations fautives', () => {
    addMigration(reference, 'CREATE TABLE "Draft" ("id" TEXT);\n');
    addMigration('20270201000000_ajout', 'ALTER TABLE "Game" ADD COLUMN "note" TEXT;\n');
    addMigration('20270202000000_suppression', 'DROP TABLE "Draft";\n');

    const run = runScript(migrationsDir, reference);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('- 20270202000000_suppression');
    expect(run.stderr).not.toContain('20270201000000_ajout');
  });

  it('sort sans erreur quand aucune migration n’est fautive', () => {
    addMigration(reference, 'CREATE TABLE "Draft" ("id" TEXT);\n');
    addMigration('20270201000000_ajout', 'ALTER TABLE "Game" ADD COLUMN "note" TEXT;\n');

    expect(runScript(migrationsDir, reference).status).toBe(0);
  });

  it('sort en erreur quand la migration de référence n’existe pas', () => {
    addMigration('20270201000000_suppression', 'DROP TABLE "Draft";\n');

    const run = runScript(migrationsDir, '20270101000000_faute_de_frappe');

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('Migration de référence introuvable');
  });
});

function runScript(dir: string, referenceMigration: string) {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  return spawnSync(
    join(scriptsDir, '../node_modules/.bin/tsx'),
    [join(scriptsDir, 'check-migrations.ts'), dir, referenceMigration],
    { encoding: 'utf8' },
  );
}
