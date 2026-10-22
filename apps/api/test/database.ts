import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/** Base dédiée à la suite `test:e2e`, distincte de la base de dev. */
export const testDatabaseUrl =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://chimeres:chimeres@localhost:5435/chimeres_test?schema=public';

const apiDir = join(import.meta.dirname, '..');
const resetScripts = [
  join(apiDir, 'test', 'reset-database.sql'),
  join(apiDir, 'prisma', 'migrations', '20261022120000_default_convention', 'migration.sql'),
];

/**
 * Ramène la base de test à son état de migration : tables vidées, convention recréée.
 * En une transaction : une lecture concurrente ne voit jamais la base sans convention.
 */
export async function resetDatabase(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
  try {
    const scripts = await Promise.all(resetScripts.map((script) => readFile(script, 'utf8')));
    await prisma.$transaction(scripts.map((script) => prisma.$executeRawUnsafe(script)));
  } finally {
    await prisma.$disconnect();
  }
}
