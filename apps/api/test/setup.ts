import { resetDatabase, testDatabaseUrl } from './database.js';

// L'application lit sa base dans DATABASE_URL : celle du worker qui exécute ce fichier.
process.env['DATABASE_URL'] = testDatabaseUrl;

// L'adresse publique des liens d'accès, que l'assistant « Créer un pseudo » crée avec un rôle. Un
// test qui la veut absente la retire par `setEnvironment`.
process.env['PUBLIC_URL'] ??= 'https://chimeres.example.org';

beforeEach(resetDatabase);
