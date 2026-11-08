import { resetDatabase, testDatabaseUrl } from './database.js';

// L'application lit sa base dans DATABASE_URL : celle du worker qui exécute ce fichier.
process.env['DATABASE_URL'] = testDatabaseUrl;

beforeEach(resetDatabase);
