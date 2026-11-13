import type { INestApplication } from '@nestjs/common';
import { request } from '../../../test/http.js';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  drawEndpoints,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  participantEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  signUpEndpoints,
  signUpTrackingEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type IdentityConfirmationDto,
  type MergeVerdictDto,
  type ParticipantListEntryDto,
  type ParticipantSheetDto,
  type ScenarioDto,
  type ScheduleDto,
  type SignUpTrackingDto,
} from '@chimeres/contract';
import { insertAccountSession, TEST_ORGANIZER_NICKNAME } from '../../../test/account-session.js';
import { startApp } from '../../../test/app.js';

describe('Liste « Participants » (ID-5)', () => {
  let app: INestApplication<App>;
  /** La session de l'Organisateur des tests (ADR 0020). */
  let organizerCookie: string;

  beforeEach(async () => {
    organizerCookie = await insertAccountSession();
  });

  /** Créneaux 1 (9 h – 11 h 30) et 2 (14 h – 16 h 30), tables « Dragon » et « Licorne ». */
  let convention: ConventionDto;

  const server = () => request(app, organizerCookie);
  const slot = (rank: number) => convention.timeSlots[rank - 1]!.id;
  const table = (name: string) => convention.tables.find((t) => t.name === name)!.id;

  /** Un MJ disponible sur les deux créneaux. */
  const gameMaster = async (nickname: string) => {
    const added = (
      (await server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname }).expect(201))
        .body as GameMasterDto[]
    ).find((candidate) => candidate.nickname === nickname)!;
    for (const rank of [1, 2]) {
      await server()
        .put(
          apiUrl(availabilityEndpoints.declare, { gameMasterId: added.id, timeSlotId: slot(rank) }),
        )
        .expect(200);
    }
    return added;
  };

  /** Programme un scénario du MJ au créneau 1, à la table : l'id de la partie. */
  const scheduled = async (
    gameMasterId: string,
    title: string,
    tableName: string,
    duration: 1 | 2 = 1,
  ) => {
    const scenario = (
      await server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId }))
        .send({
          title,
          system: 'Cthulhu',
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats: { min: 1, max: 4 },
          duration,
        })
        .expect(201)
    ).body as ScenarioDto;
    const schedule = (
      await server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({ scenarioId: scenario.id, timeSlotId: slot(1), tableId: table(tableName) })
        .expect(201)
    ).body as ScheduleDto;
    return schedule.games.find((game) => game.scenario.id === scenario.id)!.id;
  };

  /** Un téléphone relié au pseudo : son cookie, `nom=valeur`. */
  const linkedPhone = async (
    nickname: string,
    confirmation: IdentityConfirmationDto | null = null,
  ) => {
    const response = await server()
      .post(apiUrl(linkedPhoneEndpoints.link))
      .send({ presenceCode: convention.presenceCode, nickname, confirmation })
      .expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  };

  const signUp = (gameId: string, cookie: string) =>
    server().put(apiUrl(signUpEndpoints.signUp, { gameId })).set('Cookie', cookie).expect(204);

  /** La liste, sans l'Organisateur des tests, dont la session lit les pseudos. */
  const list = async (search?: string) =>
    (
      (
        await server()
          .get(apiUrl(participantEndpoints.list))
          .query(search === undefined ? {} : { search })
          .expect(200)
      ).body as ParticipantListEntryDto[]
    ).filter(({ nickname }) => nickname !== TEST_ORGANIZER_NICKNAME);

  const nicknames = (participants: ParticipantListEntryDto[]) =>
    participants.map(({ nickname }) => nickname);

  beforeEach(async () => {
    app = await startApp();
    for (const [start, end] of [
      ['09:00', '11:30'],
      ['14:00', '16:30'],
    ]) {
      await server().post(apiUrl(timeSlotEndpoints.add)).send({ start, end }).expect(201);
    }
    for (const name of ['Dragon', 'Licorne']) {
      await server().post(apiUrl(tableEndpoints.add)).send({ name }).expect(201);
    }
    convention = (await server().get(apiUrl(conventionEndpoints.read)).expect(200))
      .body as ConventionDto;
  });

  afterEach(async () => {
    await app.close();
  });

  it('rend chaque pseudo, avec ses inscriptions par créneau, l’état de chaque créneau et ses téléphones', async () => {
    const elodie = await gameMaster('Élodie');
    const kairos = await gameMaster('Kaïros');
    const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
    const brumes = await scheduled(kairos.id, 'Brumes', 'Licorne', 2);
    const lune = await linkedPhone('Lune');
    await linkedPhone('Lune', 'participant');
    await linkedPhone('Sven');
    await signUp(neons, lune);
    await signUp(brumes, lune);
    // Kaïros mène « Brumes » : son inscription à « Néons » est de secours (IN-4).
    await signUp(neons, await linkedPhone('Kaïros', 'game-master'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    const participants = await list();

    const counts = (one: number, two: number) => [
      { timeSlotId: slot(1), rank: 1, state: 'drawing', count: one },
      { timeSlotId: slot(2), rank: 2, state: 'sign-ups-open', count: two },
    ];
    expect(participants).toEqual([
      {
        id: expect.any(String),
        nickname: 'Élodie',
        gameMaster: true,
        organizer: false,
        account: null,
        signUpCounts: counts(0, 0),
        linkedPhoneCount: 0,
        matchedGameTitle: null,
      },
      {
        id: expect.any(String),
        nickname: 'Kaïros',
        gameMaster: true,
        organizer: false,
        account: null,
        signUpCounts: counts(1, 0),
        linkedPhoneCount: 1,
        matchedGameTitle: null,
      },
      // La partie double « Brumes » ne compte que sur son premier créneau.
      {
        id: expect.any(String),
        nickname: 'Lune',
        gameMaster: false,
        organizer: false,
        account: null,
        signUpCounts: counts(2, 0),
        linkedPhoneCount: 2,
        matchedGameTitle: null,
      },
      {
        id: expect.any(String),
        nickname: 'Sven',
        gameMaster: false,
        organizer: false,
        account: null,
        signUpCounts: counts(0, 0),
        linkedPhoneCount: 1,
        matchedGameTitle: null,
      },
    ]);
  });

  it.each(['elo', 'ÉLO', '  Lodi '])(
    'trouve « Élodie » par « %s » : casse, accents et espaces ignorés (ID-7)',
    async (search) => {
      await gameMaster('Élodie');
      await linkedPhone('Jean-Luc');

      expect(await list(search)).toEqual([
        expect.objectContaining({ nickname: 'Élodie', matchedGameTitle: null }),
      ]);
    },
  );

  it('compte la ponctuation : « jean luc » ne trouve pas « Jean-Luc »', async () => {
    await linkedPhone('Jean-Luc');

    expect(nicknames(await list('jean luc'))).toEqual([]);
    expect(nicknames(await list('jean-l'))).toEqual(['Jean-Luc']);
  });

  it('trouve un pseudo par le titre d’une partie où il est inscrit, et dit laquelle', async () => {
    const elodie = await gameMaster('Élodie');
    const kairos = await gameMaster('Kaïros');
    const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
    const brumes = await scheduled(kairos.id, 'Brumes du Nord', 'Licorne');
    const lune = await linkedPhone('Lune');
    await signUp(neons, lune);
    await signUp(brumes, lune);
    await signUp(neons, await linkedPhone('Sven'));
    // Le pseudo passe avant le titre : « Brune » est trouvée par son pseudo.
    await signUp(brumes, await linkedPhone('Brune'));

    // Kaïros mène « Brumes du Nord » sans y être inscrit : il n'est pas trouvé.
    expect(await list('BRU')).toEqual([
      expect.objectContaining({ nickname: 'Brune', matchedGameTitle: null }),
      expect.objectContaining({ nickname: 'Lune', matchedGameTitle: 'Brumes du Nord' }),
    ]);
  });

  it('rend tous les pseudos pour une recherche vide', async () => {
    await linkedPhone('Lune');
    await linkedPhone('Sven');

    expect(nicknames(await list('  '))).toEqual(['Lune', 'Sven']);
  });

  describe('Fiche d’un pseudo (ID-5)', () => {
    const findParticipantId = async (nickname: string) =>
      (await list()).find((participant) => participant.nickname === nickname)!.id;

    const sheet = async (nickname: string) =>
      (
        await server()
          .get(
            apiUrl(participantEndpoints.read, { participantId: await findParticipantId(nickname) }),
          )
          .expect(200)
      ).body as ParticipantSheetDto;

    it('rend son résultat sur chaque créneau, tirage publié, et ses téléphones reliés', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await linkedPhone('Lune');
      await linkedPhone('Lune', 'participant');
      await linkedPhone('Sven');
      await signUp(neons, lune);
      for (const endpoint of [drawEndpoints.launch, drawEndpoints.publish]) {
        await server()
          .post(apiUrl(endpoint, { timeSlotId: slot(1) }))
          .expect(204);
      }

      expect(await sheet('Lune')).toEqual({
        id: expect.any(String),
        nickname: 'Lune',
        gameMaster: false,
        organizer: false,
        account: null,
        signedUpGameIds: [neons],
        backupGameIds: [],
        timeSlots: [
          {
            timeSlotId: slot(1),
            rank: 1,
            state: 'published',
            result: {
              kind: 'assigned',
              tableName: 'Dragon',
              title: 'Néons',
              gameMasterNickname: 'Élodie',
            },
            ledGameId: null,
            withoutGame: false,
            latecomerAdditionAllowed: false,
          },
          {
            timeSlotId: slot(2),
            rank: 2,
            state: 'sign-ups-open',
            result: { kind: 'signed-up', signUpCount: 0 },
            ledGameId: null,
            withoutGame: false,
            latecomerAdditionAllowed: false,
          },
        ],
        linkedPhones: [
          { linkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
          { linkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
        ],
      });
      expect(await sheet('Élodie')).toMatchObject({
        gameMaster: true,
        timeSlots: [{ result: { kind: 'leading', title: 'Néons', tableName: 'Dragon' } }, {}],
        linkedPhones: [],
      });
      expect((await sheet('Sven')).timeSlots[0]!.result).toEqual({ kind: 'not-in-draw' });
    });

    it.each(['00000000-0000-4000-8000-000000000000', 'abc'])(
      'répond 404 pour un pseudo inconnu : « %s »',
      async (participantId) => {
        const response = await server()
          .get(apiUrl(participantEndpoints.read, { participantId }))
          .expect(404);

        expect(response.body).toMatchObject({ code: 'participant-not-found' });
      },
    );
  });

  describe('Création d’un pseudo par un Organisateur (ID-12)', () => {
    const add = (nickname: string) =>
      server().post(apiUrl(participantEndpoints.add)).send({ nickname });

    it('crée le pseudo et rend sa fiche : 201', async () => {
      const response = await add('  Élodie ').expect(201);

      const sheet = response.body as ParticipantSheetDto;
      expect(sheet).toMatchObject({ nickname: 'Élodie', gameMaster: false, linkedPhones: [] });
      expect(nicknames(await list())).toEqual(['Élodie']);
    });

    it('refuse un pseudo de participant déjà pris : 422, rattaché au pseudo, avec son identifiant', async () => {
      const elodie = (await add('Élodie').expect(201)).body as ParticipantSheetDto;

      const response = await add('ELODIE')
        .expect(422)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({
        code: 'nickname-taken-by-participant',
        params: { nickname: 'Élodie', participantId: elodie.id },
        errors: [{ field: 'nickname', code: 'nickname-taken-by-participant' }],
      });
      expect(nicknames(await list())).toEqual(['Élodie']);
    });

    it('refuse le pseudo d’un MJ, avec l’identifiant de son participant (ID-4)', async () => {
      await gameMaster('Kaïros');
      const [kairos] = await list();

      const response = await add('kairos').expect(422);

      expect(response.body).toMatchObject({
        code: 'nickname-taken',
        params: { nickname: 'Kaïros', participantId: kairos!.id },
      });
      expect(response.body.detail).toMatch(/^Le MJ «\s*Kaïros\s*»/);
    });

    it('relie ensuite un téléphone au pseudo, après la confirmation de ID-1', async () => {
      const elodie = (await add('Élodie').expect(201)).body as ParticipantSheetDto;

      const question = await server()
        .post(apiUrl(linkedPhoneEndpoints.link))
        .send({ presenceCode: convention.presenceCode, nickname: 'elodie', confirmation: null })
        .expect(200);
      await linkedPhone('elodie', 'participant');

      expect(question.body).toEqual({
        status: 'confirmation-needed',
        confirmation: 'participant',
        nickname: 'Élodie',
      });
      const sheet = (
        await server()
          .get(apiUrl(participantEndpoints.read, { participantId: elodie.id }))
          .expect(200)
      ).body as ParticipantSheetDto;
      expect(sheet.linkedPhones).toHaveLength(1);
    });
  });

  describe('Renommer un pseudo (ID-13)', () => {
    const add = async (nickname: string) =>
      (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
        .body as ParticipantSheetDto;
    const rename = (participantId: string, nickname: string) =>
      server().put(apiUrl(participantEndpoints.rename, { participantId })).send({ nickname });

    it('renomme le pseudo et rend sa fiche ; un téléphone relié lit le nouveau nom', async () => {
      const elodie = await add('Élodie');
      const cookie = await linkedPhone('elodie', 'participant');

      const response = await rename(elodie.id, '  Céleste ').expect(200);

      expect(response.body).toMatchObject({ id: elodie.id, nickname: 'Céleste' });
      const phone = await server()
        .get(apiUrl(linkedPhoneEndpoints.read))
        .set('Cookie', cookie)
        .expect(200);
      expect(phone.body).toMatchObject({ nickname: 'Céleste' });
    });

    it('libère l’ancien nom : le saisir sur un téléphone crée un nouveau pseudo', async () => {
      const elodie = await add('Élodie');
      await rename(elodie.id, 'Céleste').expect(200);

      const response = await server()
        .post(apiUrl(linkedPhoneEndpoints.link))
        .send({ presenceCode: convention.presenceCode, nickname: 'Élodie', confirmation: null })
        .expect(200);

      expect(response.body).toEqual({ status: 'linked', nickname: 'Élodie' });
      expect(nicknames(await list())).toEqual(['Céleste', 'Élodie']);
    });

    it('refuse le pseudo d’un autre : 422, rattaché au pseudo, avec son identifiant', async () => {
      const elodie = await add('Élodie');
      const lune = await add('Lune');

      const response = await rename(lune.id, 'ELODIE').expect(422);

      expect(response.body).toMatchObject({
        code: 'nickname-taken-by-participant',
        params: { nickname: 'Élodie', participantId: elodie.id },
        errors: [{ field: 'nickname', code: 'nickname-taken-by-participant' }],
      });
    });

    it('renomme le pseudo d’un MJ, que sa fiche de MJ reprend', async () => {
      const added = await gameMaster('Kaïros');
      const [kairos] = await list();

      await rename(kairos!.id, 'Brann').expect(200);

      const sheet = await server()
        .get(apiUrl(gameMasterEndpoints.read, { gameMasterId: added.id }))
        .expect(200);
      expect(sheet.body).toMatchObject({ nickname: 'Brann' });
    });

    it('rend 404 pour un pseudo inconnu', async () => {
      await rename('inconnu', 'Alix').expect(404);
    });
  });

  describe('Inscrire à la place d’un participant (ID-12)', () => {
    const add = async (nickname: string) =>
      (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
        .body as ParticipantSheetDto;
    const signUpOnBehalf = (participantId: string, gameId: string) =>
      server().put(apiUrl(participantEndpoints.signUp, { participantId, gameId }));
    const withdrawOnBehalf = (participantId: string, gameId: string) =>
      server().delete(apiUrl(participantEndpoints.withdraw, { participantId, gameId }));
    const withdrawFromDrawOnBehalf = (participantId: string, timeSlotId: string) =>
      server().delete(apiUrl(participantEndpoints.withdrawFromDraw, { participantId, timeSlotId }));
    const readSheet = async (participantId: string) =>
      (await server().get(apiUrl(participantEndpoints.read, { participantId })).expect(200))
        .body as ParticipantSheetDto;

    it('inscrit le pseudo et rend sa fiche ; une inscription répétée ne change rien', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');

      const response = await signUpOnBehalf(lune.id, neons).expect(200);
      await signUpOnBehalf(lune.id, neons).expect(200);

      expect(response.body).toMatchObject({
        id: lune.id,
        signedUpGameIds: [neons],
        backupGameIds: [],
        timeSlots: [
          { result: { kind: 'signed-up', signUpCount: 1 }, ledGameId: null, withoutGame: false },
          { result: { kind: 'signed-up', signUpCount: 0 } },
        ],
      });
      expect((await list())[1]).toMatchObject({
        nickname: 'Lune',
        signUpCounts: [{ count: 1 }, { count: 0 }],
      });
    });

    it('désinscrit le pseudo ; une partie déjà quittée ne change rien', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');
      await signUpOnBehalf(lune.id, neons).expect(200);

      const response = await withdrawOnBehalf(lune.id, neons).expect(200);
      await withdrawOnBehalf(lune.id, neons).expect(200);

      expect(response.body).toMatchObject({ signedUpGameIds: [] });
      expect((await readSheet(lune.id)).signedUpGameIds).toEqual([]);
    });

    it('inscrit un MJ en secours sur un créneau où il mène, et refuse sa propre partie (IN-4)', async () => {
      const elodie = await gameMaster('Élodie');
      const kairos = await gameMaster('Kaïros');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const brumes = await scheduled(kairos.id, 'Brumes', 'Licorne');
      const kairosId = (await list()).find(({ nickname }) => nickname === 'Kaïros')!.id;

      const backup = await signUpOnBehalf(kairosId, neons).expect(200);
      const own = await signUpOnBehalf(kairosId, brumes).expect(422);

      expect(backup.body).toMatchObject({
        signedUpGameIds: [],
        backupGameIds: [neons],
        timeSlots: [{ ledGameId: brumes }, { ledGameId: null }],
      });
      expect(own.body).toMatchObject({ code: 'game-led-by-participant' });
      expect((await readSheet(kairosId)).backupGameIds).toEqual([neons]);
    });

    it('refuse une fois le tirage du créneau lancé : 422, rien ne change', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');
      await signUp(neons, await linkedPhone('Sven'));
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);

      const response = await signUpOnBehalf(lune.id, neons).expect(422);
      const withdrawn = await withdrawOnBehalf(lune.id, neons).expect(422);
      const withdrawnFromDraw = await withdrawFromDrawOnBehalf(lune.id, slot(1)).expect(422);

      expect(response.body).toMatchObject({
        code: 'sign-ups-closed',
        detail: 'Le tirage du créneau 1 est lancé : ses inscriptions sont fermées.',
      });
      expect(withdrawn.body).toMatchObject({ code: 'sign-ups-closed' });
      expect(withdrawnFromDraw.body).toMatchObject({ code: 'sign-ups-closed' });
      expect((await readSheet(lune.id)).signedUpGameIds).toEqual([]);
    });

    it('retire du tirage le pseudo sans partie sur le créneau (IN-6)', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');
      await signUpOnBehalf(lune.id, neons).expect(200);
      await server()
        .delete(apiUrl(scheduleEndpoints.unschedule, { gameId: neons }))
        .expect(200);
      const before = await readSheet(lune.id);

      const response = await withdrawFromDrawOnBehalf(lune.id, slot(1)).expect(200);
      await withdrawFromDrawOnBehalf(lune.id, slot(1)).expect(200);

      expect(before.timeSlots[0]!.withoutGame).toBe(true);
      expect((response.body as ParticipantSheetDto).timeSlots[0]!.withoutGame).toBe(false);
    });

    it('rend 404 pour un pseudo ou une partie inconnus', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');

      expect((await signUpOnBehalf('inconnu', neons).expect(404)).body).toMatchObject({
        code: 'participant-not-found',
      });
      expect(
        (await signUpOnBehalf(lune.id, '00000000-0000-4000-8000-000000000000').expect(404)).body,
      ).toMatchObject({ code: 'game-not-found' });
    });
  });

  describe('Supprimer un pseudo (ID-10)', () => {
    const add = async (nickname: string) =>
      (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
        .body as ParticipantSheetDto;
    const remove = (participantId: string) =>
      server().delete(apiUrl(participantEndpoints.remove, { participantId }));

    it('supprime le pseudo, même après la publication : 204, téléphone plus relié, pseudo libre', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');
      const cookie = await linkedPhone('Lune', 'participant');
      await signUp(neons, cookie);
      for (const endpoint of [drawEndpoints.launch, drawEndpoints.publish]) {
        await server()
          .post(apiUrl(endpoint, { timeSlotId: slot(1) }))
          .expect(204);
      }

      await remove(lune.id).expect(204);

      await server()
        .get(apiUrl(participantEndpoints.read, { participantId: lune.id }))
        .expect(404);
      await server().get(apiUrl(linkedPhoneEndpoints.read)).set('Cookie', cookie).expect(401);
      const relinked = await server()
        .post(apiUrl(linkedPhoneEndpoints.link))
        .send({ presenceCode: convention.presenceCode, nickname: 'Lune', confirmation: null })
        .expect(200);
      expect(relinked.body).toEqual({ status: 'linked', nickname: 'Lune' });
    });

    it('refuse le pseudo d’un MJ : 422 participant-is-game-master', async () => {
      await gameMaster('Kaïros');
      const [kairos] = await list();

      const response = await remove(kairos!.id).expect(422);

      expect(response.body).toMatchObject({
        code: 'participant-is-game-master',
        params: { nickname: 'Kaïros' },
      });
      expect(nicknames(await list())).toEqual(['Kaïros']);
    });

    it('rend 404 pour un pseudo inconnu', async () => {
      await remove('inconnu').expect(404);
    });
  });

  describe('Ajouter un retardataire à un tirage publié (ID-14)', () => {
    const add = async (nickname: string) =>
      (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
        .body as ParticipantSheetDto;
    const addLatecomer = (participantId: string, timeSlotId: string) =>
      server().put(apiUrl(participantEndpoints.addLatecomer, { participantId, timeSlotId }));
    const drawOfFirstTimeSlot = async () =>
      (
        (await server().get(apiUrl(signUpTrackingEndpoints.read)).expect(200))
          .body as SignUpTrackingDto
      ).timeSlots[0]!.draw!;

    /** « Néons » d'Élodie au créneau 1, de 1 à 4 places, où Sven joue ; le tirage est publié. */
    const publishFirstTimeSlot = async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      await signUp(neons, await linkedPhone('Sven'));
      for (const endpoint of [drawEndpoints.launch, drawEndpoints.publish]) {
        await server()
          .post(apiUrl(endpoint, { timeSlotId: slot(1) }))
          .expect(204);
      }
    };

    it('l’ajoute non placé et rend sa fiche ; le résumé compte un non placé de plus, les places ne changent pas', async () => {
      await publishFirstTimeSlot();
      const lune = await add('Lune');
      const before = await drawOfFirstTimeSlot();

      const response = await addLatecomer(lune.id, slot(1)).expect(200);

      expect((response.body as ParticipantSheetDto).timeSlots[0]).toMatchObject({
        state: 'published',
        result: {
          kind: 'unassigned',
          tablesWithSeats: [{ tableName: 'Dragon', freeSeatCount: 3 }],
        },
      });
      const after = await drawOfFirstTimeSlot();
      expect(after.unassignedCount).toBe(before.unassignedCount + 1);
      expect(after.freeSeatCount).toBe(before.freeSeatCount);
    });

    it('la fiche dit où l’ajout est possible : sur un tirage publié où il n’est pas, plus après l’ajout', async () => {
      await publishFirstTimeSlot();
      const lune = await add('Lune');
      const readSheet = async () =>
        (
          await server()
            .get(apiUrl(participantEndpoints.read, { participantId: lune.id }))
            .expect(200)
        ).body as ParticipantSheetDto;

      expect(
        (await readSheet()).timeSlots.map((timeSlot) => timeSlot.latecomerAdditionAllowed),
      ).toEqual([true, false]);

      const response = await addLatecomer(lune.id, slot(1)).expect(200);

      expect(
        (response.body as ParticipantSheetDto).timeSlots.map(
          (slot) => slot.latecomerAdditionAllowed,
        ),
      ).toEqual([false, false]);
    });

    it('refuse un pseudo déjà dans le tirage, puis un tirage pas publié : 422', async () => {
      await publishFirstTimeSlot();
      const lune = await add('Lune');
      await addLatecomer(lune.id, slot(1)).expect(200);

      const again = await addLatecomer(lune.id, slot(1)).expect(422);
      const notPublished = await addLatecomer(lune.id, slot(2)).expect(422);

      expect(again.body).toMatchObject({
        code: 'latecomer-already-in-draw',
        detail: 'Lune est déjà dans le tirage du créneau 1.',
      });
      expect(notPublished.body).toMatchObject({ code: 'draw-not-published' });
    });

    it('refuse le MJ qui mène sur le créneau (IN-4)', async () => {
      await publishFirstTimeSlot();
      const elodieId = (await list()).find(({ nickname }) => nickname === 'Élodie')!.id;

      const response = await addLatecomer(elodieId, slot(1)).expect(422);

      expect(response.body).toMatchObject({ code: 'latecomer-leads-on-time-slot' });
    });

    it('rend 404 pour un pseudo inconnu', async () => {
      await publishFirstTimeSlot();

      expect((await addLatecomer('inconnu', slot(1)).expect(404)).body).toMatchObject({
        code: 'participant-not-found',
      });
    });
  });

  describe('Couper les liens d’un pseudo (ID-5, ID-8)', () => {
    const add = async (nickname: string) =>
      (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
        .body as ParticipantSheetDto;
    const unlinkPhones = (participantId: string) =>
      server().delete(apiUrl(participantEndpoints.unlinkPhones, { participantId }));
    const readPhone = (cookie: string) =>
      server().get(apiUrl(linkedPhoneEndpoints.read)).set('Cookie', cookie);

    it('coupe tous les liens du pseudo et rend sa fiche ; ses téléphones reviennent à l’identification', async () => {
      const elodie = await add('Élodie');
      const first = await linkedPhone('Élodie', 'participant');
      const second = await linkedPhone('Élodie', 'participant');
      await add('Lune');
      const lune = await linkedPhone('Lune', 'participant');

      const response = await unlinkPhones(elodie.id).expect(200);

      expect(response.body).toMatchObject({ id: elodie.id, nickname: 'Élodie', linkedPhones: [] });
      expect((await readPhone(first).expect(401)).body).toMatchObject({ code: 'phone-not-linked' });
      await readPhone(second).expect(401);
      await readPhone(lune).expect(200);
    });

    it('laisse le pseudo libre d’être relié de nouveau, sans verrou', async () => {
      const elodie = await add('Élodie');
      await linkedPhone('Élodie', 'participant');
      await unlinkPhones(elodie.id).expect(200);

      const cookie = await linkedPhone('Élodie', 'participant');

      expect((await readPhone(cookie).expect(200)).body).toMatchObject({ nickname: 'Élodie' });
    });

    it('coupe les liens du pseudo d’un MJ', async () => {
      await gameMaster('Kaïros');
      const [kairos] = await list();
      const cookie = await linkedPhone('Kaïros', 'game-master');

      await unlinkPhones(kairos!.id).expect(200);

      await readPhone(cookie).expect(401);
    });

    it('rend 404 pour un pseudo inconnu', async () => {
      expect((await unlinkPhones('inconnu').expect(404)).body).toMatchObject({
        code: 'participant-not-found',
      });
    });
  });

  describe('Fusionner deux pseudos (ID-11)', () => {
    const add = async (nickname: string) =>
      (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
        .body as ParticipantSheetDto;
    const merge = (participantId: string, destinationId: string) =>
      server().post(apiUrl(participantEndpoints.merge, { participantId, destinationId }));
    const readMergeVerdict = (participantId: string, destinationId: string) =>
      server().get(apiUrl(participantEndpoints.readMergeVerdict, { participantId, destinationId }));

    it('dit ce que la fusion fera, sans rien changer', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');
      await signUp(neons, await linkedPhone('Sven'));
      const sven = (await list()).find(({ nickname }) => nickname === 'Sven')!;

      const response = await readMergeVerdict(sven.id, lune.id).expect(200);

      expect(response.body).toEqual({
        timeSlots: [
          {
            timeSlotId: slot(1),
            rank: 1,
            assignment: null,
            destinationLeavesDraw: false,
            transferredSignUpTitles: ['Néons'],
            backupSignUpTitles: [],
            lostSignUpTitles: [],
            withoutGame: null,
          },
          {
            timeSlotId: slot(2),
            rank: 2,
            assignment: null,
            destinationLeavesDraw: false,
            transferredSignUpTitles: [],
            backupSignUpTitles: [],
            lostSignUpTitles: [],
            withoutGame: null,
          },
        ],
      });
      expect(nicknames(await list())).toEqual(['Élodie', 'Lune', 'Sven']);
    });

    it('donne l’affectation de la source dans le verdict, avec sa partie et sa table', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');
      await signUp(neons, await linkedPhone('Sven'));
      const sven = (await list()).find(({ nickname }) => nickname === 'Sven')!;
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);

      const response = await readMergeVerdict(sven.id, lune.id).expect(200);

      expect((response.body as MergeVerdictDto).timeSlots[0]!.assignment).toEqual({
        title: 'Néons',
        tableName: 'Dragon',
        outcome: 'transferred',
      });
    });

    it('fusionne, rend la fiche de la destination, supprime la source et coupe ses liens', async () => {
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Dragon');
      const lune = await add('Lune');
      const cookie = await linkedPhone('Sven');
      await signUp(neons, cookie);
      const sven = (await list()).find(({ nickname }) => nickname === 'Sven')!;

      const response = await merge(sven.id, lune.id).expect(200);

      expect(response.body).toMatchObject({
        id: lune.id,
        nickname: 'Lune',
        signedUpGameIds: [neons],
      });
      expect(nicknames(await list())).toEqual(['Élodie', 'Lune']);
      await server().get(apiUrl(linkedPhoneEndpoints.read)).set('Cookie', cookie).expect(401);
    });

    it('fusionne dans le pseudo d’un MJ', async () => {
      await gameMaster('Kaïros');
      const kairos = (await list()).find(({ nickname }) => nickname === 'Kaïros')!;
      const lune = await add('Lune');

      const response = await merge(lune.id, kairos.id).expect(200);

      expect(response.body).toMatchObject({ id: kairos.id, gameMaster: true });
    });

    it('refuse une source MJ, ou la fusion d’un pseudo dans lui-même : 422', async () => {
      await gameMaster('Kaïros');
      const kairos = (await list()).find(({ nickname }) => nickname === 'Kaïros')!;
      const lune = await add('Lune');

      const fromGameMaster = await merge(kairos.id, lune.id).expect(422);
      const intoItself = await merge(lune.id, lune.id).expect(422);
      const verdict = await readMergeVerdict(lune.id, lune.id).expect(422);

      expect(fromGameMaster.body).toMatchObject({
        code: 'participant-is-game-master',
        detail:
          'Kaïros est MJ\u00a0: son pseudo se gère depuis sa fiche de MJ, dans «\u00a0MJ\u00a0».',
      });
      expect(intoItself.body).toMatchObject({ code: 'merge-into-itself' });
      expect(verdict.body).toMatchObject({ code: 'merge-into-itself' });
      expect(nicknames(await list())).toEqual(['Kaïros', 'Lune']);
    });

    it('rend 404 pour un pseudo inconnu', async () => {
      const lune = await add('Lune');

      await merge('inconnu', lune.id).expect(404);
      await merge(lune.id, 'inconnu').expect(404);
      await readMergeVerdict(lune.id, 'inconnu').expect(404);
    });
  });
});
