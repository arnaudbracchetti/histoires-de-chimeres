import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildTestDatabaseUrl, testWorkerCount } from './database.js';

/**
 * Migre la base de chaque worker au démarrage de la suite, toutes en même temps.
 * `migrate deploy` crée une base qui manque.
 */
export default async function setup(): Promise<void> {
  const workers = Array.from({ length: testWorkerCount }, (_, index) => index + 1);
  await Promise.all(
    workers.map((worker) =>
      promisify(execFile)('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
        env: { ...process.env, DATABASE_URL: buildTestDatabaseUrl(worker) },
      }),
    ),
  );
}
