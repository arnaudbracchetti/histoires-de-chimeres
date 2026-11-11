import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  test as base,
  type APIRequestContext,
  type BrowserContext,
  type PlaywrightWorkerArgs,
} from '@playwright/test';
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

/** Le pseudo de l'Organisateur des tests, entré dans le back office par sa session (ADR 0020). */
export const ORGANIZER_NICKNAME = 'Organisateur des tests';

/** Le jeton de la session de l'Organisateur des tests : la base n'en garde que le SHA-256. */
const ORGANIZER_SESSION_ID = 'session-des-tests-playwright-00000000000000';

/**
 * Le participant, le compte et la session de l'Organisateur des tests, créés s'ils manquent (ADR
 * 0020). Les identifiants sont fixes. La session est rouverte maintenant : la base du projet
 * `mobile`, jamais remise à zéro, la garderait sinon au-delà de sa durée de vie (ADR 0019). Les
 * dates sont en UTC, comme Prisma les écrit.
 */
const ORGANIZER_SQL = `
INSERT INTO "Participant" ("id", "conventionId", "nickname")
  SELECT '00000000-0000-4000-8000-000000000001', "id", '${ORGANIZER_NICKNAME}' FROM "Convention"
  ON CONFLICT DO NOTHING;
INSERT INTO "Account" ("id", "participantId", "organizer")
  VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', true)
  ON CONFLICT DO NOTHING;
INSERT INTO "AccountSession" ("idHash", "accountId", "openedAt", "lastActiveAt")
  VALUES (
    '${createHash('sha256').update(ORGANIZER_SESSION_ID).digest('hex')}',
    '00000000-0000-4000-8000-000000000002',
    now() AT TIME ZONE 'UTC',
    now() AT TIME ZONE 'UTC'
  )
  ON CONFLICT ("idHash") DO UPDATE
    SET "openedAt" = EXCLUDED."openedAt", "lastActiveAt" = EXCLUDED."lastActiveAt";
`;

/** Exécute ces scripts SQL dans la base e2e, en une transaction. */
async function runInTransaction(scripts: string[]): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(['BEGIN', ...scripts, 'COMMIT'].join(';\n'));
  } finally {
    await client.end();
  }
}

/**
 * Ramène la base e2e à son état de migration : tables vidées, convention recréée, puis
 * l'Organisateur des tests et sa session. En une transaction : le front office, testé en parallèle,
 * ne voit jamais la base sans convention.
 */
async function resetDatabase(): Promise<void> {
  const scripts = await Promise.all(resetScripts.map((script) => readFile(script, 'utf8')));
  await runInTransaction([...scripts, ORGANIZER_SQL]);
}

/** Le cookie de session de l'Organisateur des tests, `__Host-` comme celui de l'API (ADR 0019). */
const ORGANIZER_COOKIE = {
  name: '__Host-account-session',
  value: ORGANIZER_SESSION_ID,
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
} as const;

/**
 * La fixture `request` (un contexte d'API à part, hors du navigateur) avec le cookie de
 * l'Organisateur des tests, comme le contexte de la page.
 */
async function organizerRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string,
  extraHTTPHeaders: Record<string, string> | undefined,
  use: (request: APIRequestContext) => Promise<void>,
): Promise<void> {
  const request = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders,
    storageState: {
      cookies: [{ ...ORGANIZER_COOKIE, domain: new URL(baseURL).hostname, path: '/', expires: -1 }],
      origins: [],
    },
  });
  await use(request);
  await request.dispose();
}

/**
 * Pose le cookie de la session de l'Organisateur des tests dans le contexte : la page et
 * `page.request` entrent dans le back office sans passer par la connexion (ADR 0020). Les fixtures
 * le font pour le contexte du test ; un test l'appelle pour un contexte qu'il ouvre lui-même.
 */
export async function addOrganizerCookie(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([
    {
      ...ORGANIZER_COOKIE,
      // Chromium refuse un cookie `Secure` posé pour une URL http ; posé pour son équivalent
      // https, il l'envoie ensuite à http://localhost, qu'il tient pour sûr.
      url: baseURL.replace(/^http:/, 'https:'),
    },
  ]);
}

/**
 * `test` des parcours qui dépendent des données : la base est remise à zéro avant chacun, et le
 * contexte entre comme l'Organisateur des tests. Une base n'a qu'une convention, donc ces tests
 * s'exécutent en série (projet « bureau »).
 */
export const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [
    async ({ context, baseURL }, use) => {
      await resetDatabase();
      await addOrganizerCookie(context, baseURL!);
      await use();
    },
    { auto: true },
  ],
  request: ({ playwright, baseURL, extraHTTPHeaders }, use) =>
    organizerRequest(playwright, baseURL!, extraHTTPHeaders, use),
});

/**
 * `test` du projet `mobile`, dont la base n'est jamais remise à zéro : l'Organisateur des tests et
 * sa session sont créés s'ils manquent, et le contexte entre comme lui, pour préparer les données
 * par l'API. Le téléphone garde son propre cookie : la session n'y donne aucun droit (ID-3).
 */
export const phoneTest = base.extend<{ organizerSession: void }>({
  organizerSession: [
    async ({ context, baseURL }, use) => {
      await runInTransaction([ORGANIZER_SQL]);
      await addOrganizerCookie(context, baseURL!);
      await use();
    },
    { auto: true },
  ],
  request: ({ playwright, baseURL, extraHTTPHeaders }, use) =>
    organizerRequest(playwright, baseURL!, extraHTTPHeaders, use),
});

export { expect } from '@playwright/test';
