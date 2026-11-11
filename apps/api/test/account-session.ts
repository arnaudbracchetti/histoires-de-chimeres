import { createHash, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ACCOUNT_SESSION_COOKIE } from '../src/account/http/account-session-cookie.js';
import { hashSessionId } from '../src/account/persistence/prisma-account-sessions.js';
import { testDatabaseUrl } from './database.js';

/** Le jeton de la session de l'Organisateur des tests : la base n'en garde que le SHA-256 (ADR 0020). */
export const TEST_SESSION_ID = 'session-des-tests-de-l-api-0000000000000000';

/** Le pseudo de l'Organisateur des tests. */
export const TEST_ORGANIZER_NICKNAME = 'Organisateur des tests';

type AccountSessionOptions = {
  nickname?: string;
  organizer?: boolean;
  /** Le participant du compte est aussi un MJ (ADR 0012). */
  gameMaster?: boolean;
  /** La session s'ouvre à cette heure, maintenant par défaut. */
  openedAt?: Date;
};

/**
 * Insère en SQL un participant, son compte et une session au jeton connu, puis renvoie l'en-tête
 * `Cookie` de cette session et l'identifiant du MJ, ou `null` (ADR 0020) : les tests entrent sans
 * route de connexion. Le compte n'a pas de mot de passe ; il est Organisateur sauf mention
 * contraire. Le jeton dérive du pseudo, sauf pour l'Organisateur des tests, dont c'est
 * `TEST_SESSION_ID` : plusieurs comptes ont chacun leur session.
 */
export async function insertSession({
  nickname = TEST_ORGANIZER_NICKNAME,
  organizer = true,
  gameMaster = false,
  openedAt = new Date(),
}: AccountSessionOptions = {}): Promise<{ cookie: string; gameMasterId: string | null }> {
  const sessionId =
    nickname === TEST_ORGANIZER_NICKNAME
      ? TEST_SESSION_ID
      : createHash('sha256').update(nickname).digest('base64url');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
  try {
    const { id: conventionId } = await prisma.convention.findFirstOrThrow({ select: { id: true } });
    const participantId = randomUUID();
    const accountId = randomUUID();
    const gameMasterId = gameMaster ? randomUUID() : null;
    await prisma.$transaction([
      prisma.participant.create({ data: { id: participantId, conventionId, nickname } }),
      ...(gameMasterId
        ? [prisma.gameMaster.create({ data: { id: gameMasterId, conventionId, participantId } })]
        : []),
      prisma.account.create({ data: { id: accountId, participantId, organizer } }),
      prisma.accountSession.create({
        data: { idHash: hashSessionId(sessionId), accountId, openedAt, lastActiveAt: openedAt },
      }),
    ]);
    return { cookie: `${ACCOUNT_SESSION_COOKIE}=${sessionId}`, gameMasterId };
  } finally {
    await prisma.$disconnect();
  }
}

/** Comme `insertSession`, mais ne renvoie que l'en-tête `Cookie`. */
export async function insertAccountSession(options: AccountSessionOptions = {}): Promise<string> {
  return (await insertSession(options)).cookie;
}

/** Une session de MJ seul, sans le rôle d'Organisateur : son cookie et son MJ. */
export async function insertGameMasterSession(
  nickname: string,
): Promise<{ cookie: string; gameMasterId: string }> {
  const { cookie, gameMasterId } = await insertSession({
    nickname,
    organizer: false,
    gameMaster: true,
  });
  return { cookie, gameMasterId: gameMasterId! };
}
