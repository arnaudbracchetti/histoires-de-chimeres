import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import {
  accountEndpoints,
  apiUrl,
  gameMasterEndpoints,
  participantEndpoints,
  type AddedParticipantDto,
  type ParticipantListEntryDto,
  type ParticipantSheetDto,
} from '@chimeres/contract';
import {
  insertAccountSession,
  insertSession,
  TEST_ORGANIZER_NICKNAME,
} from '../../../test/account-session.js';
import { startApp } from '../../../test/app.js';
import { request } from '../../../test/http.js';

describe("Suppression et fusion d'un pseudo qui a un compte (ID-10, ID-11, ID-16)", () => {
  let app: INestApplication<App>;
  /** La session de l'Organisateur des tests (ADR 0020). */
  let organizerCookie: string;

  beforeEach(async () => {
    organizerCookie = await insertAccountSession();
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = (cookie = organizerCookie) => request(app, cookie);
  const addParticipant = async (nickname: string) =>
    (
      (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
        .body as AddedParticipantDto
    ).participantId;
  const readSheet = async (participantId: string) =>
    (await server().get(apiUrl(participantEndpoints.read, { participantId })).expect(200))
      .body as ParticipantSheetDto;
  const removeParticipant = (participantId: string, cookie?: string) =>
    server(cookie).delete(apiUrl(participantEndpoints.remove, { participantId }));
  const merge = (participantId: string, destinationId: string) =>
    server().post(apiUrl(participantEndpoints.merge, { participantId, destinationId }));
  const readMergeVerdict = (participantId: string, destinationId: string) =>
    server().get(apiUrl(participantEndpoints.readMergeVerdict, { participantId, destinationId }));
  const appointOrganizer = (participantId: string) =>
    server().put(apiUrl(participantEndpoints.appointOrganizer, { participantId })).expect(200);
  const readOwnAccount = (cookie: string) => server(cookie).get(apiUrl(accountEndpoints.read));
  /** Le participant d'une session insérée, par son pseudo. */
  const findParticipantIdByNickname = async (nickname: string) => {
    const { body } = await server()
      .get(apiUrl(participantEndpoints.list))
      .query({ search: nickname })
      .expect(200);
    return (body as ParticipantListEntryDto[]).find(
      (entry) => entry.nickname === nickname,
    )!.id;
  };

  describe('suppression (ID-10)', () => {
    it('supprime aussi le compte du pseudo et ferme ses sessions', async () => {
      const { cookie } = await insertSession({ nickname: 'Kaïros' });
      await readOwnAccount(cookie).expect(200);
      const participantId = await findParticipantIdByNickname('Kaïros');

      await removeParticipant(participantId).expect(204);

      await readOwnAccount(cookie).expect(401);
      await server().get(apiUrl(participantEndpoints.read, { participantId })).expect(404);
    });

    it("refuse qu'un Organisateur supprime son propre pseudo", async () => {
      const participantId = await findParticipantIdByNickname(TEST_ORGANIZER_NICKNAME);

      const response = await removeParticipant(participantId).expect(422);

      expect(response.body).toMatchObject({
        code: 'own-nickname-removal',
        detail: 'Tu ne peux pas supprimer ton propre pseudo : un autre Organisateur peut le faire.',
      });
      await readOwnAccount(organizerCookie).expect(200);
    });

    it("refuse qu'un Organisateur MJ supprime son propre pseudo depuis sa fiche de MJ", async () => {
      const { cookie, gameMasterId } = await insertSession({
        nickname: 'Brann',
        gameMaster: true,
      });

      const response = await server(cookie)
        .delete(apiUrl(gameMasterEndpoints.remove, { gameMasterId: gameMasterId! }))
        .expect(422);

      expect(response.body).toMatchObject({ code: 'own-nickname-removal' });
      await readOwnAccount(cookie).expect(200);
    });

    it("supprime le pseudo d'un MJ qui a un compte, depuis sa fiche de MJ", async () => {
      const { cookie, gameMasterId } = await insertSession({
        nickname: 'Brann',
        organizer: false,
        gameMaster: true,
      });

      await server()
        .delete(apiUrl(gameMasterEndpoints.remove, { gameMasterId: gameMasterId! }))
        .expect(204);

      await readOwnAccount(cookie).expect(401);
    });
  });

  describe('fusion (ID-11)', () => {
    it("refuse une source qui a un compte, jusqu'au verdict", async () => {
      const sourceId = await addParticipant('Lune');
      await appointOrganizer(sourceId);
      const destinationId = await addParticipant('Ciel');

      const responses = [
        await readMergeVerdict(sourceId, destinationId).expect(422),
        await merge(sourceId, destinationId).expect(422),
      ];

      for (const response of responses) {
        expect(response.body).toMatchObject({
          code: 'merge-source-has-account',
          detail:
            "Lune a un compte : retire-lui d'abord ses rôles, dans l'onglet « Compte », avant de le fusionner.",
        });
      }
      expect(await readSheet(sourceId)).toMatchObject({ organizer: true });
    });

    it('accepte une destination qui a un compte, qui ne change pas', async () => {
      const { cookie } = await insertSession({ nickname: 'Kaïros' });
      const destinationId = await findParticipantIdByNickname('Kaïros');
      const sourceId = await addParticipant('Lune');

      await readMergeVerdict(sourceId, destinationId).expect(200);
      await merge(sourceId, destinationId).expect(200);

      expect(await readSheet(destinationId)).toMatchObject({ organizer: true });
      expect((await readOwnAccount(cookie).expect(200)).body).toMatchObject({ organizer: true });
      await server()
        .get(apiUrl(participantEndpoints.read, { participantId: sourceId }))
        .expect(404);
    });
  });
});
