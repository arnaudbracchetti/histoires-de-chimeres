import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import {
  accountEndpoints,
  apiUrl,
  availabilityEndpoints,
  gameMasterEndpoints,
  participantEndpoints,
  scenarioEndpoints,
  timeSlotEndpoints,
  type ConnectedAccountDto,
  type ConventionDto,
  type GameMasterDto,
  type ParticipantSheetDto,
} from '@chimeres/contract';
import {
  insertAccountSession,
  insertGameMasterSession,
  insertSession,
  TEST_ORGANIZER_NICKNAME,
} from '../../../test/account-session.js';
import { startApp } from '../../../test/app.js';
import { request } from '../../../test/http.js';

const UNKNOWN_ID = '8d3c1a8e-0000-4000-8000-000000000000';

describe('Rôles du pseudo, donnés et retirés par un Organisateur (ID-16)', () => {
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
        .body as ParticipantSheetDto
    ).id;
  const readSheet = async (participantId: string) =>
    (await server().get(apiUrl(participantEndpoints.read, { participantId })).expect(200))
      .body as ParticipantSheetDto;
  const appointOrganizer = (participantId: string, cookie?: string) =>
    server(cookie).put(apiUrl(participantEndpoints.appointOrganizer, { participantId }));
  const withdrawOrganizerRole = (participantId: string, cookie?: string) =>
    server(cookie).delete(apiUrl(participantEndpoints.withdrawOrganizerRole, { participantId }));
  const appointGameMaster = (participantId: string) =>
    server().put(apiUrl(participantEndpoints.appointGameMaster, { participantId }));
  const withdrawGameMasterRole = (participantId: string) =>
    server().delete(apiUrl(participantEndpoints.withdrawGameMasterRole, { participantId }));
  const listGameMasters = async () =>
    (await server().get(apiUrl(gameMasterEndpoints.list)).expect(200)).body as GameMasterDto[];
  const readOwnAccount = (cookie: string) => server(cookie).get(apiUrl(accountEndpoints.read));
  /** Le participant d'une session insérée, par son pseudo. */
  const findParticipantIdByNickname = async (nickname: string) => {
    const { body } = await server()
      .get(apiUrl(participantEndpoints.list))
      .query({ search: nickname })
      .expect(200);
    return (body as { id: string; nickname: string }[]).find(
      (entry) => entry.nickname === nickname,
    )!.id;
  };

  it('donne le rôle Organisateur à un participant : la fiche le dit', async () => {
    const participantId = await addParticipant('Lune');

    const response = await appointOrganizer(participantId).expect(200);

    expect(response.body).toMatchObject({
      id: participantId,
      organizer: true,
      gameMaster: false,
      account: { onlyRole: 'organizer' },
    });
    expect(await readSheet(participantId)).toMatchObject({ organizer: true });
  });

  it('donne le rôle MJ à un participant existant, qui garde son pseudo (ID-4)', async () => {
    const participantId = await addParticipant('Lune');

    const response = await appointGameMaster(participantId).expect(200);

    expect(response.body).toMatchObject({
      id: participantId,
      nickname: 'Lune',
      gameMaster: true,
      organizer: false,
      account: { onlyRole: 'game-master' },
    });
    expect((await listGameMasters()).map(({ nickname }) => nickname)).toEqual(['Lune']);
  });

  it('donne le rôle MJ à un Organisateur : son compte reste le même, sa session aussi', async () => {
    const { cookie } = await insertSession({ nickname: 'Kaïros' });
    const participantId = await findParticipantIdByNickname('Kaïros');

    await appointGameMaster(participantId).expect(200);

    const account = (await readOwnAccount(cookie).expect(200)).body as ConnectedAccountDto;
    expect(account).toMatchObject({ nickname: 'Kaïros', organizer: true, participantId });
    expect(account.gameMasterId).not.toBeNull();
  });

  it('retirer le dernier rôle supprime le compte et ses sessions ; le pseudo reste', async () => {
    const { cookie } = await insertSession({ nickname: 'Kaïros' });
    const participantId = await findParticipantIdByNickname('Kaïros');

    const response = await withdrawOrganizerRole(participantId).expect(200);

    expect(response.body).toMatchObject({
      nickname: 'Kaïros',
      organizer: false,
      gameMaster: false,
      account: null,
    });
    await readOwnAccount(cookie).expect(401);
  });

  it('retirer un rôle quand il en reste un garde le compte et sa session, sans le droit retiré (ID-16)', async () => {
    const { cookie } = await insertSession({ nickname: 'Kaïros', gameMaster: true });
    const participantId = await findParticipantIdByNickname('Kaïros');

    await withdrawOrganizerRole(participantId).expect(200);

    expect((await readOwnAccount(cookie).expect(200)).body).toMatchObject({ organizer: false });
    await server(cookie).get(apiUrl(participantEndpoints.list)).expect(403);
  });

  it("refuse qu'un Organisateur se retire lui-même le rôle d'Organisateur", async () => {
    const participantId = await findParticipantIdByNickname(TEST_ORGANIZER_NICKNAME);

    const response = await withdrawOrganizerRole(participantId).expect(422);

    expect(response.body).toMatchObject({ code: 'own-organizer-role-withdrawal' });
    expect(await readSheet(participantId)).toMatchObject({ organizer: true });
  });

  it("retire le rôle d'Organisateur à un autre Organisateur, qui peut le rendre", async () => {
    const { cookie } = await insertSession({ nickname: 'Kaïros' });
    const testOrganizerId = await findParticipantIdByNickname(TEST_ORGANIZER_NICKNAME);

    const withdrawn = await withdrawOrganizerRole(testOrganizerId, cookie).expect(200);

    expect(withdrawn.body).toMatchObject({ organizer: false });
    await readOwnAccount(organizerCookie).expect(401);
    const appointed = await appointOrganizer(testOrganizerId, cookie).expect(200);
    expect(appointed.body).toMatchObject({ organizer: true });
  });

  it('refuse de retirer le rôle MJ tant que le MJ a un scénario (PR-12)', async () => {
    const participantId = await addParticipant('Lune');
    await appointGameMaster(participantId).expect(200);
    const [{ id: gameMasterId }] = await listGameMasters();
    await server()
      .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: gameMasterId! }))
      .send({
        title: 'Brumes',
        system: 'Cthulhu',
        presentation: 'Une enquête.',
        contentWarnings: '',
        seats: { min: 3, max: 5 },
        duration: 1,
      })
      .expect(201);

    const response = await withdrawGameMasterRole(participantId).expect(422);

    expect(response.body).toMatchObject({
      code: 'game-master-has-scenarios',
      params: { scenarios: 1 },
    });
    expect(await readSheet(participantId)).toMatchObject({ gameMaster: true });
  });

  it('retire le rôle MJ sans scénario : ses disponibilités partent, son participant reste', async () => {
    const participantId = await addParticipant('Lune');
    await appointGameMaster(participantId).expect(200);
    const [{ id: gameMasterId }] = await listGameMasters();
    const { timeSlots } = (
      await server()
        .post(apiUrl(timeSlotEndpoints.add))
        .send({ start: '09:00', end: '11:30' })
        .expect(201)
    ).body as ConventionDto;
    await server()
      .put(
        apiUrl(availabilityEndpoints.declare, {
          gameMasterId: gameMasterId!,
          timeSlotId: timeSlots[0]!.id,
        }),
      )
      .expect(200);

    const response = await withdrawGameMasterRole(participantId).expect(200);

    expect(response.body).toMatchObject({ nickname: 'Lune', gameMaster: false });
    expect(await listGameMasters()).toEqual([]);
    await appointGameMaster(participantId).expect(200);
    expect((await listGameMasters())[0]).toMatchObject({ nickname: 'Lune', availabilities: [] });
  });

  it('retirer le rôle MJ à un compte qui n’est que MJ supprime le compte et ses sessions', async () => {
    const { cookie } = await insertGameMasterSession('Kaïros');
    const participantId = await findParticipantIdByNickname('Kaïros');

    const response = await withdrawGameMasterRole(participantId).expect(200);

    expect(response.body).toMatchObject({ gameMaster: false, organizer: false, account: null });
    await readOwnAccount(cookie).expect(401);
  });

  it('un participant sans rôle n’a pas de compte', async () => {
    const participantId = await addParticipant('Lune');

    expect(await readSheet(participantId)).toMatchObject({ organizer: false, account: null });
  });

  it('refuse un pseudo inconnu', async () => {
    await appointOrganizer(UNKNOWN_ID).expect(404);
    await appointGameMaster(UNKNOWN_ID).expect(404);
    await withdrawOrganizerRole(UNKNOWN_ID).expect(404);
    await withdrawGameMasterRole(UNKNOWN_ID).expect(404);
  });

  it('est réservé aux Organisateurs : un MJ reçoit 403', async () => {
    const participantId = await addParticipant('Lune');
    const { cookie } = await insertGameMasterSession('Kaïros');

    await appointOrganizer(participantId, cookie).expect(403);
  });
});
