import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type IdentityConfirmationDto,
  type ParticipantListEntryDto,
  type ParticipantSheetDto,
  type ScenarioDto,
  type ScheduleDto,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Liste « Participants » (ID-5)', () => {
  let app: INestApplication<App>;
  /** Créneaux 1 (9 h – 11 h 30) et 2 (14 h – 16 h 30), tables « Dragon » et « Licorne ». */
  let convention: ConventionDto;

  const server = () => request(app.getHttpServer());
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

  const list = async (search?: string) =>
    (
      await server()
        .get(apiUrl(participantEndpoints.list))
        .query(search === undefined ? {} : { search })
        .expect(200)
    ).body as ParticipantListEntryDto[];

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
        signUpCounts: counts(0, 0),
        linkedPhoneCount: 0,
        matchedGameTitle: null,
      },
      {
        id: expect.any(String),
        nickname: 'Kaïros',
        gameMaster: true,
        signUpCounts: counts(1, 0),
        linkedPhoneCount: 1,
        matchedGameTitle: null,
      },
      // La partie double « Brumes » ne compte que sur son premier créneau.
      {
        id: expect.any(String),
        nickname: 'Lune',
        gameMaster: false,
        signUpCounts: counts(2, 0),
        linkedPhoneCount: 2,
        matchedGameTitle: null,
      },
      {
        id: expect.any(String),
        nickname: 'Sven',
        gameMaster: false,
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
          },
          {
            timeSlotId: slot(2),
            rank: 2,
            state: 'sign-ups-open',
            result: { kind: 'signed-up', signUpCount: 0 },
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
});
