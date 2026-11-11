import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ACCOUNT_SESSION_COOKIE } from '../src/account/http/account-session-cookie.js';
import { hashSessionId } from '../src/account/persistence/prisma-account-sessions.js';
import { testDatabaseUrl } from './database.js';

/** Le jeton de la session insérée par les tests : la base n'en garde que le SHA-256 (ADR 0020). */
export const TEST_SESSION_ID = 'session-des-tests-de-l-api-0000000000000000';

/**
 * Insère en SQL un participant, son compte et une session au jeton connu, puis renvoie l'en-tête
 * `Cookie` de cette session (ADR 0020) : les tests entrent sans route de connexion. Le compte n'a
 * pas de mot de passe ; il est Organisateur sauf mention contraire. La session s'ouvre à `openedAt`,
 * maintenant par défaut : un test à l'horloge réglée lui donne son heure.
 */
export async function insertAccountSession({
  nickname = 'Organisateur des tests',
  organizer = true,
  openedAt = new Date(),
}: { nickname?: string; organizer?: boolean; openedAt?: Date } = {}): Promise<string> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
  try {
    const { id: conventionId } = await prisma.convention.findFirstOrThrow({ select: { id: true } });
    const participantId = randomUUID();
    const accountId = randomUUID();
    await prisma.$transaction([
      prisma.participant.create({ data: { id: participantId, conventionId, nickname } }),
      prisma.account.create({ data: { id: accountId, participantId, organizer } }),
      prisma.accountSession.create({
        data: {
          idHash: hashSessionId(TEST_SESSION_ID),
          accountId,
          openedAt,
          lastActiveAt: openedAt,
        },
      }),
    ]);
    return `${ACCOUNT_SESSION_COOKIE}=${TEST_SESSION_ID}`;
  } finally {
    await prisma.$disconnect();
  }
}
