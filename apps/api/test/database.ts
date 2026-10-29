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
  join(apiDir, 'test', 'restore-presence-code.sql'),
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

/** Les tables des enfants de la convention, avec la clé de leurs lignes. */
const conventionChildren = {
  TimeSlot: '"id"',
  Table: '"id"',
  GameMaster: '"id"',
  Participant: '"id"',
  Availability: `"gameMasterId" || ':' || "timeSlotId"`,
  Game: '"id"',
  GameTimeSlot: `"gameId" || ':' || "timeSlotId"`,
};

/**
 * La dernière écriture de chaque ligne des enfants de la convention, par table puis par clé.
 * PostgreSQL la note dans la colonne système `xmin`, qui change à chaque écriture, même à
 * l'identique : deux relevés égaux prouvent qu'une ligne n'a pas été réécrite.
 */
export async function rowWrites(): Promise<Record<string, Record<string, string>>> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
  try {
    const writes: Record<string, Record<string, string>> = {};
    for (const [table, key] of Object.entries(conventionChildren)) {
      const rows = await prisma.$queryRawUnsafe<{ key: string; xmin: string }[]>(
        `SELECT ${key} AS key, xmin::text AS xmin FROM "${table}"`,
      );
      writes[table] = Object.fromEntries(rows.map((row) => [row.key, row.xmin]));
    }
    return writes;
  } finally {
    await prisma.$disconnect();
  }
}
