import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test as base } from '@playwright/test';
import pg from 'pg';

/** Base de l'image lancée par Playwright (service app-e2e de docker-compose.yml), jamais la base de dev. */
const databaseUrl =
  process.env['E2E_DATABASE_URL'] ??
  'postgresql://chimeres:chimeres@localhost:5435/chimeres_e2e?schema=public';

// Les mêmes scripts que la suite HTTP de l'API (apps/api/test/database.ts).
const apiDir = join(import.meta.dirname, '..', 'apps', 'api');
const resetScripts = [
  join(apiDir, 'test', 'reset-database.sql'),
  join(apiDir, 'prisma', 'migrations', '20261022120000_default_convention', 'migration.sql'),
  join(apiDir, 'test', 'restore-presence-code.sql'),
];

/**
 * Ramène la base e2e à son état de migration : tables vidées, convention recréée.
 * En une transaction : le front office, testé en parallèle, ne voit jamais la base sans convention.
 */
async function resetDatabase(): Promise<void> {
  const scripts = await Promise.all(resetScripts.map((script) => readFile(script, 'utf8')));
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(['BEGIN', ...scripts, 'COMMIT'].join(';\n'));
  } finally {
    await client.end();
  }
}

/**
 * `test` des parcours qui dépendent des données : la base est remise à zéro avant chacun.
 * Une base n'a qu'une convention, donc ces tests s'exécutent en série (projet « bureau »).
 */
export const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [
    async ({}, use) => {
      await resetDatabase();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
