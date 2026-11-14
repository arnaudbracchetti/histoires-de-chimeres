// Contrôle des migrations destructives (docs/Regles-ecriture-de-code.md, « Migrations de la base »).
// Une migration postérieure au premier déploiement doit laisser tourner la version précédente :
// un ordre destructif n'y passe qu'avec la ligne `-- incompatible : <raison>`.
//
// Usage : tsx scripts/check-migrations.ts [dossier des migrations] [migration de référence]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Dernière migration avant le premier déploiement en production : les migrations jusqu'à elle
// ne sont pas contrôlées. À avancer jusqu'au premier déploiement, puis à ne plus toucher.
const lastMigrationBeforeFirstDeployment = '20261113172947_access_link';

const defaultMigrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../prisma/migrations');

const destructiveStatements = [
  { label: 'DROP', pattern: /\bDROP\b/i },
  { label: 'RENAME', pattern: /\bRENAME\b/i },
  { label: 'SET NOT NULL', pattern: /\bSET\s+NOT\s+NULL\b/i },
  {
    label: 'ALTER … TYPE',
    pattern: /\bALTER\s+(COLUMN\s+)?("[^"]+"|\S+)\s+(SET\s+DATA\s+)?TYPE\b/i,
  },
];

// Le « : » accepte une espace insécable (U+00A0) avant et après lui.
const incompatibleDeclaration = /^--[ \t\u00a0]*incompatible[ \t\u00a0]*:[ \t\u00a0]*[^\s]/i;

// Un seul passage, dans l'ordre du texte : un « -- » dans une chaîne n'ouvre pas de commentaire.
const commentOrString = /\/\*[\s\S]*?\*\/|--[^\n]*|'(?:[^']|'')*'/g;

export function findUndeclaredDestructiveMigrations(
  migrationsDir: string,
  referenceMigration: string,
): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name > referenceMigration)
    .map((entry) => entry.name)
    .sort()
    .filter((name) =>
      isUndeclaredDestructive(readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8')),
    );
}

function isUndeclaredDestructive(sql: string): boolean {
  const lineComments = sql.match(commentOrString)?.filter((token) => token.startsWith('--')) ?? [];
  if (lineComments.some((comment) => incompatibleDeclaration.test(comment))) return false;
  const statements = sql.replace(commentOrString, (token) => (token.startsWith("'") ? "''" : ' '));
  return destructiveStatements.some(({ pattern }) => pattern.test(statements));
}

function isRunAsScript(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isRunAsScript()) {
  const [
    migrationsDir = defaultMigrationsDir,
    referenceMigration = lastMigrationBeforeFirstDeployment,
  ] = process.argv.slice(2);
  if (!existsSync(join(migrationsDir, referenceMigration))) {
    console.error(
      `Migration de référence introuvable : ${join(migrationsDir, referenceMigration)}`,
    );
    process.exit(2);
  }
  const undeclared = findUndeclaredDestructiveMigrations(migrationsDir, referenceMigration);
  if (undeclared.length > 0) {
    const labels = destructiveStatements.map(({ label }) => label).join(', ');
    console.error(
      `Migrations destructives (${labels}) sans la ligne « -- incompatible : <raison> » :`,
    );
    for (const name of undeclared) console.error(`- ${name}`);
    console.error('Voir docs/Regles-ecriture-de-code.md, « Migrations de la base ».');
    process.exit(1);
  }
  console.log(`Migrations après ${referenceMigration} : aucun ordre destructif non déclaré.`);
}
