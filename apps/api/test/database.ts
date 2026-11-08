import { readFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Nombre de workers de la suite `test:e2e`, un par cœur (`TEST_WORKERS` pour en changer). Chacun a
 * sa base : ses fichiers s'exécutent en parallèle de ceux des autres, et en série entre eux. Au-delà
 * d'un worker par cœur, l'API et PostgreSQL se disputent le processeur et les tests expirent.
 */
export const testWorkerCount = Number(process.env['TEST_WORKERS'] ?? availableParallelism());

/**
 * Base du worker `worker` (1 à `testWorkerCount`) : celle de `TEST_DATABASE_URL`, ou
 * `chimeres_test`, suivie de son numéro. Toujours distincte de la base de dev.
 */
export function buildTestDatabaseUrl(worker: number): string {
  const url = new URL(
    process.env['TEST_DATABASE_URL'] ??
      'postgresql://chimeres:chimeres@localhost:5435/chimeres_test?schema=public',
  );
  url.pathname = `${url.pathname}_${worker}`;
  return url.toString();
}

/** Base du worker courant. Vitest numérote ses workers de 1 à `maxWorkers` (`VITEST_POOL_ID`). */
export const testDatabaseUrl = buildTestDatabaseUrl(Number(process.env['VITEST_POOL_ID'] ?? 1));

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
