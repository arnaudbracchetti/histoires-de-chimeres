import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './database.js';

/** Migre la base de test au démarrage de la suite. `migrate deploy` la crée si elle manque. */
export default function setup(): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
}
