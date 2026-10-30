import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  frontOfficeEndpoints,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  signUpEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type FrontOfficeScheduleDto,
  type IdentityConfirmationDto,
  type ParticipantSituationDto,
  type GameMasterDto,
  type GameMasterSheetDto,
  type MovePlacementDto,
  type PlacementDto,
  type ScenarioDto,
  type ScheduleDto,
  type MoveGameBody,
  type ScheduleGameBody,
  type ScenarioListItemDto,
  type SwapGamesBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';
import { rowWrites } from '../../../test/database.js';

const UNKNOWN_ID = '8d3c1a8e-0000-4000-8000-000000000000';

describe('Programme', () => {
  let app: INestApplication<App>;
  /** Créneaux 1 (9 h) et 2 (14 h), tables « Table 1 » et « Table 2 ». */
  let convention: ConventionDto;
  /** « Élodie », disponible sur les deux créneaux ; « Kaïros », sur le créneau 1. */
  let elodie: GameMasterDto;
  let kairos: GameMasterDto;
  /** « Néons » et « Ruines » d'Élodie ; « Brumes » de Kaïros. */
  let neons: ScenarioDto;
  let ruines: ScenarioDto;
  let brumes: ScenarioDto;

  const server = () => request(app.getHttpServer());

  const proposeScenario = async (gameMasterId: string, title: string, duration: 1 | 2 = 1) =>
    (
      await server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId }))
        .send({
          title,
          system: 'Cthulhu',
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats: { min: 3, max: 5 },
          duration,
        })
        .expect(201)
    ).body as ScenarioDto;

  beforeEach(async () => {
    app = await startApp();
    for (const start of ['09:00', '14:00']) {
      await server()
        .post(apiUrl(timeSlotEndpoints.add))
        .send({ start, end: start.replace(/^(\d\d):00/, (_, h) => `${Number(h) + 2}:30`) })
        .expect(201);
    }
    for (const name of ['Table 1', 'Table 2']) {
      convention = (await server().post(apiUrl(tableEndpoints.add)).send({ name }).expect(201))
        .body as ConventionDto;
    }
    for (const nickname of ['Élodie', 'Kaïros']) {
      await server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname }).expect(201);
    }
    const gameMasters = (await server().get(apiUrl(gameMasterEndpoints.list)).expect(200))
      .body as GameMasterDto[];
    [elodie, kairos] = gameMasters as [GameMasterDto, GameMasterDto];
    const [s1, s2] = convention.timeSlots.map(({ id }) => id) as [string, string];
    for (const [gameMasterId, timeSlotId] of [
      [elodie.id, s1],
      [elodie.id, s2],
      [kairos.id, s1],
    ] as const) {
      await server()
        .put(apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId }))
        .expect(200);
    }
    neons = await proposeScenario(elodie.id, 'Néons');
    ruines = await proposeScenario(elodie.id, 'Ruines');
    brumes = await proposeScenario(kairos.id, 'Brumes');
  });

  afterEach(async () => {
    await app.close();
  });

  const slot = (rank: number) => convention.timeSlots[rank - 1]!.id;
  const table = (name: string) => convention.tables.find((t) => t.name === name)!.id;
  const read = async () =>
    (await server().get(apiUrl(scheduleEndpoints.read)).expect(200)).body as ScheduleDto;
  const schedule = (body: ScheduleGameBody | object) =>
    server().post(apiUrl(scheduleEndpoints.schedule)).send(body);
  const placements = (scenarioId: string) =>
    server().get(apiUrl(scheduleEndpoints.placements, { scenarioId }));
  /** Les titres en réserve, créneau par créneau. */
  const reserveTitles = (dto: ScheduleDto) =>
    convention.timeSlots.map((_, index) =>
      dto.reserve.filter(({ timeSlots }) => timeSlots[index]!.inReserve).map(({ title }) => title),
    );
  const placeOf = (dto: ScheduleDto, title: string) =>
    dto.reserve
      .find((scenario) => scenario.title === title)!
      .timeSlots.map(({ inReserve, scheduled }) =>
        inReserve ? 'réserve' : scheduled ? 'programmé' : '-',
      );

  it('lit un programme vide, avec la réserve de chaque créneau (PR-6)', async () => {
    const dto = await read();

    expect(dto.games).toEqual([]);
    expect(reserveTitles(dto)).toEqual([
      ['Brumes', 'Néons', 'Ruines'],
      ['Néons', 'Ruines'],
    ]);
    expect(dto.reserve.map(({ title }) => title)).toEqual(['Brumes', 'Néons', 'Ruines']);
    expect(dto.reserve[0]).toMatchObject({
      gameMaster: { id: kairos.id, nickname: 'Kaïros' },
      timeSlots: [
        { timeSlotId: slot(1), inReserve: true, scheduled: false },
        { timeSlotId: slot(2), inReserve: false, scheduled: false },
      ],
      unschedulable: null,
    });
  });

  it('garde en réserve un scénario programmé sur un autre créneau (PR-3, PR-6)', async () => {
    await schedule({
      scenarioId: neons.id,
      timeSlotId: slot(1),
      tableId: table('Table 1'),
    }).expect(201);

    const dto = await read();
    expect(placeOf(dto, 'Néons')).toEqual(['programmé', 'réserve']);
    expect(placeOf(dto, 'Ruines')).toEqual(['-', 'réserve']);
    expect(dto.reserve.find(({ title }) => title === 'Néons')!.unschedulable).toBeNull();
  });

  it("donne le scénario d'un MJ sans disponibilité, sans créneau possible et avec sa raison", async () => {
    await server()
      .delete(
        apiUrl(availabilityEndpoints.withdraw, { gameMasterId: kairos.id, timeSlotId: slot(1) }),
      )
      .expect(200);

    const dto = await read();
    expect(placeOf(dto, 'Brumes')).toEqual(['-', '-']);
    expect(dto.reserve.find(({ title }) => title === 'Brumes')!.unschedulable).toEqual({
      code: 'game-master-without-availability',
      title: 'MJ sans disponibilité',
      detail: "Kaïros n'a aucune disponibilité : coche ses créneaux sur sa fiche.",
    });
  });

  it('programme une partie, et renvoie le programme relu (PR-3)', async () => {
    const response = await schedule({
      scenarioId: neons.id,
      timeSlotId: slot(1),
      tableId: table('Table 1'),
    }).expect(201);

    const dto = response.body as ScheduleDto;
    expect(dto).toEqual(await read());
    expect(dto.games).toEqual([
      {
        id: expect.any(String),
        tableId: table('Table 1'),
        timeSlotIds: [slot(1)],
        seats: { min: 3, max: 5 },
        scenario: expect.objectContaining({
          id: neons.id,
          title: 'Néons',
          system: 'Cthulhu',
          gameMaster: { id: elodie.id, nickname: 'Élodie' },
        }),
      },
    ]);
    expect(reserveTitles(dto)).toEqual([['Brumes'], ['Néons', 'Ruines']]);
    const list = (await server().get(apiUrl(scenarioEndpoints.list)).expect(200))
      .body as ScenarioListItemDto[];
    expect(list.find(({ id }) => id === neons.id)!.games).toBe(1);
  });

  it.each([
    [
      'MJ indisponible',
      () => ({ scenarioId: brumes.id, timeSlotId: slot(2), tableId: table('Table 1') }),
      'game-master-unavailable',
      "Kaïros n'est pas disponible sur le créneau 2\u00a0: coche d'abord sa disponibilité sur sa fiche.",
    ],
    [
      'MJ déjà occupé',
      () => ({ scenarioId: ruines.id, timeSlotId: slot(1), tableId: table('Table 2') }),
      'game-master-busy',
      'Élodie mène déjà une partie sur le créneau 1\u00a0: choisis un autre créneau.',
    ],
    [
      'Table prise',
      () => ({ scenarioId: brumes.id, timeSlotId: slot(1), tableId: table('Table 1') }),
      'table-taken',
      'La table «\u00a0Table 1\u00a0» accueille déjà une partie sur le créneau 1\u00a0: choisis une autre table.',
    ],
  ])(
    'refuse « %s » : 422, avec le motif et la phrase (PR-5)',
    async (title, body, code, detail) => {
      await schedule({
        scenarioId: neons.id,
        timeSlotId: slot(1),
        tableId: table('Table 1'),
      }).expect(201);

      const response = await schedule(body())
        .expect(422)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({ code, title, detail });
      expect((await read()).games).toHaveLength(1);
    },
  );

  it('la fiche du MJ donne les parties qu’il mène, avec leur scénario et leur table', async () => {
    await schedule({
      scenarioId: ruines.id,
      timeSlotId: slot(2),
      tableId: table('Table 2'),
    }).expect(201);
    await schedule({ scenarioId: neons.id, timeSlotId: slot(1), tableId: table('Table 1') }).expect(
      201,
    );
    const games = (await read()).games;
    const gameOf = (title: string) => games.find(({ scenario }) => scenario.title === title)!.id;

    const response = await server()
      .get(apiUrl(gameMasterEndpoints.read, { gameMasterId: elodie.id }))
      .expect(200);

    expect((response.body as GameMasterDto).games).toEqual([
      {
        gameId: gameOf('Néons'),
        timeSlotId: slot(1),
        table: { id: table('Table 1'), name: 'Table 1' },
        scenario: { id: neons.id, title: 'Néons' },
      },
      {
        gameId: gameOf('Ruines'),
        timeSlotId: slot(2),
        table: { id: table('Table 2'), name: 'Table 2' },
        scenario: { id: ruines.id, title: 'Ruines' },
      },
    ]);
  });

  it('répond 404 à un scénario, un créneau ou une table inconnus', async () => {
    const base = { scenarioId: neons.id, timeSlotId: slot(1), tableId: table('Table 1') };

    await schedule({ ...base, scenarioId: UNKNOWN_ID }).expect(404);
    await schedule({ ...base, timeSlotId: UNKNOWN_ID }).expect(404);
    await schedule({ ...base, tableId: UNKNOWN_ID }).expect(404);
    await schedule({ scenarioId: neons.id }).expect(400);
  });

  /** Programme « Néons » sur le créneau 1, Table 1, et renvoie l'identifiant de la partie. */
  const scheduleNeons = async () => {
    const dto = (
      await schedule({
        scenarioId: neons.id,
        timeSlotId: slot(1),
        tableId: table('Table 1'),
      }).expect(201)
    ).body as ScheduleDto;
    return dto.games[0]!.id;
  };
  const unschedule = (gameId: string) =>
    server().delete(apiUrl(scheduleEndpoints.unschedule, { gameId })).expect(200);

  it('refuse de supprimer un créneau ou une table qui porte une partie, puis accepte après la déprogrammation : 422 (PR-10)', async () => {
    const gameId = await scheduleNeons();

    const timeSlot = await server()
      .delete(apiUrl(timeSlotEndpoints.remove, { timeSlotId: slot(1) }))
      .expect(422);
    expect(timeSlot.body).toMatchObject({
      code: 'time-slot-has-games',
      title: 'Créneau programmé',
      detail: "Le créneau 1 porte une partie\u00a0: déprogramme-la d'abord.",
    });
    const tableResponse = await server()
      .delete(apiUrl(tableEndpoints.remove, { tableId: table('Table 1') }))
      .expect(422);
    expect(tableResponse.body).toMatchObject({
      code: 'table-has-games',
      title: 'Table programmée',
      detail: "La table «\u00a0Table 1\u00a0» porte une partie\u00a0: déprogramme-la d'abord.",
    });
    await server()
      .put(apiUrl(tableEndpoints.rename, { tableId: table('Table 1') }))
      .send({ name: 'Dragon' })
      .expect(200);

    await unschedule(gameId);
    await server()
      .delete(apiUrl(timeSlotEndpoints.remove, { timeSlotId: slot(1) }))
      .expect(200);
    await server()
      .delete(apiUrl(tableEndpoints.remove, { tableId: table('Table 1') }))
      .expect(200);
  });

  it('refuse de changer les heures d’un créneau qui porte une partie : 422 (PR-11)', async () => {
    await scheduleNeons();

    const response = await server()
      .put(apiUrl(timeSlotEndpoints.changeHours, { timeSlotId: slot(1) }))
      .send({ start: '08:00', end: '10:30' })
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'time-slot-hours-locked-by-games',
      title: 'Heures figées',
      detail:
        'Le créneau 1 porte une partie\u00a0: ses heures ne changent plus. Pour les changer, déprogramme-la, supprime le créneau, puis recrée-le.',
    });
  });

  it('refuse de changer la durée ou de supprimer un scénario qui a une partie, puis accepte après la déprogrammation : 422 (PR-14)', async () => {
    const gameId = await scheduleNeons();
    const update = (duration: 1 | 2) =>
      server()
        .put(apiUrl(scenarioEndpoints.update, { scenarioId: neons.id }))
        .send({
          title: 'Néons',
          system: 'Cthulhu',
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats: { min: 3, max: 6 },
          duration,
        });
    const remove = () =>
      server().delete(apiUrl(scenarioEndpoints.remove, { scenarioId: neons.id }));

    const duration = await update(2).expect(422);
    expect(duration.body).toMatchObject({
      code: 'scenario-duration-locked',
      title: 'Durée figée',
      errors: [
        {
          field: 'duration',
          message:
            "Ce scénario est programmé\u00a0: sa durée ne change plus. Déprogramme d'abord ses parties.",
        },
      ],
    });
    await update(1).expect(200);
    const removal = await remove().expect(422);
    expect(removal.body).toMatchObject({
      code: 'scenario-has-games',
      title: 'Scénario programmé',
      detail: "Ce scénario est programmé\u00a0: déprogramme d'abord ses parties.",
    });

    await unschedule(gameId);
    await update(2).expect(200);
    await remove().expect(204);
  });

  it('refuse de retirer une disponibilité sur laquelle le MJ mène une partie, puis accepte après la déprogrammation : 422 (PR-15)', async () => {
    const gameId = await scheduleNeons();
    const withdraw = () =>
      server().delete(
        apiUrl(availabilityEndpoints.withdraw, { gameMasterId: elodie.id, timeSlotId: slot(1) }),
      );

    const response = await withdraw().expect(422);
    expect(response.body).toMatchObject({
      code: 'availability-has-game',
      title: 'Disponibilité programmée',
      detail: "Élodie mène une partie sur le créneau 1\u00a0: déprogramme-la d'abord.",
    });

    await unschedule(gameId);
    expect((await withdraw().expect(200)).body.availabilities).toEqual([slot(2)]);
  });

  it('la fiche du MJ donne le verdict de retrait de chaque disponibilité, égal au refus de l’écriture (PR-15)', async () => {
    await scheduleNeons();

    const sheet = (
      await server()
        .get(apiUrl(gameMasterEndpoints.read, { gameMasterId: elodie.id }))
        .expect(200)
    ).body as GameMasterSheetDto;

    expect(sheet.withdrawals).toEqual([
      {
        timeSlotId: slot(1),
        refusal: {
          code: 'availability-has-game',
          title: 'Disponibilité programmée',
          detail: "Élodie mène une partie sur le créneau 1\u00a0: déprogramme-la d'abord.",
        },
      },
      { timeSlotId: slot(2), refusal: null },
    ]);
    expect(sheet.games).toEqual([
      expect.objectContaining({ timeSlotId: slot(1), scenario: { id: neons.id, title: 'Néons' } }),
    ]);
  });

  it('donne la grille des verdicts, égale aux refus de l’écriture', async () => {
    await schedule({ scenarioId: neons.id, timeSlotId: slot(1), tableId: table('Table 1') }).expect(
      201,
    );

    const response = await placements(brumes.id).expect(200);

    expect(response.body as PlacementDto[]).toEqual([
      {
        timeSlotId: slot(1),
        tableId: table('Table 1'),
        refusal: {
          code: 'table-taken',
          title: 'Table prise',
          detail:
            'La table «\u00a0Table 1\u00a0» accueille déjà une partie sur le créneau 1\u00a0: choisis une autre table.',
        },
      },
      { timeSlotId: slot(1), tableId: table('Table 2'), refusal: null },
      {
        timeSlotId: slot(2),
        tableId: table('Table 1'),
        refusal: expect.objectContaining({
          code: 'game-master-unavailable',
          title: 'MJ indisponible',
        }),
      },
      {
        timeSlotId: slot(2),
        tableId: table('Table 2'),
        refusal: expect.objectContaining({ code: 'game-master-unavailable' }),
      },
    ]);
    await placements(UNKNOWN_ID).expect(404);
  });

  describe('Partie double (PR-5, PR-8, PR-11)', () => {
    /** « Abysses », double, d'Élodie. */
    let abysses: ScenarioDto;

    beforeEach(async () => {
      abysses = await proposeScenario(elodie.id, 'Abysses', 2);
    });

    it('se programme sur son premier créneau, et prend le suivant à la même table', async () => {
      const response = await schedule({
        scenarioId: abysses.id,
        timeSlotId: slot(1),
        tableId: table('Table 1'),
      }).expect(201);

      const dto = response.body as ScheduleDto;
      expect(dto.games).toEqual([
        expect.objectContaining({
          tableId: table('Table 1'),
          timeSlotIds: [slot(1), slot(2)],
          scenario: expect.objectContaining({ id: abysses.id, duration: 2 }),
        }),
      ]);
      expect(placeOf(dto, 'Abysses')).toEqual(['programmé', 'programmé']);
      expect(placeOf(dto, 'Néons')).toEqual(['-', '-']);
    });

    it('refuse « Pas de créneau suivant » sur le dernier créneau : 422, et la grille le dit', async () => {
      const response = await schedule({
        scenarioId: abysses.id,
        timeSlotId: slot(2),
        tableId: table('Table 1'),
      }).expect(422);

      expect(response.body).toMatchObject({
        code: 'no-next-time-slot',
        title: 'Pas de créneau suivant',
        detail:
          'Le créneau 2 est le dernier de la journée\u00a0: une partie double commence au plus tard sur le créneau 1.',
      });
      const verdicts = (await placements(abysses.id).expect(200)).body as PlacementDto[];
      expect(verdicts.map(({ refusal }) => refusal?.code ?? null)).toEqual([
        null,
        null,
        'no-next-time-slot',
        'no-next-time-slot',
      ]);
      expect(placeOf(await read(), 'Abysses')).toEqual(['réserve', '-']);
    });

    it('refuse un créneau ajouté ou déplacé entre ses deux créneaux : 422, rattaché au début', async () => {
      await schedule({
        scenarioId: abysses.id,
        timeSlotId: slot(1),
        tableId: table('Table 1'),
      }).expect(201);

      const added = await server()
        .post(apiUrl(timeSlotEndpoints.add))
        .send({ start: '12:00', end: '13:00' })
        .expect(422);
      expect(added.body).toMatchObject({
        code: 'time-slot-splits-two-slot-game',
        title: 'Partie double coupée',
        detail:
          "Ce créneau tomberait entre les créneaux 1 et 2, qu'occupe une partie double\u00a0: choisis d'autres heures.",
        errors: [{ field: 'start', code: 'time-slot-splits-two-slot-game' }],
      });

      const evening = (
        await server()
          .post(apiUrl(timeSlotEndpoints.add))
          .send({ start: '17:00', end: '19:30' })
          .expect(201)
      ).body as ConventionDto;
      await server()
        .put(apiUrl(timeSlotEndpoints.changeHours, { timeSlotId: evening.timeSlots[2]!.id }))
        .send({ start: '12:00', end: '13:00' })
        .expect(422)
        .expect(({ body }) => expect(body.code).toBe('time-slot-splits-two-slot-game'));
    });
  });

  describe('Déplacer et déprogrammer une partie (PR-17)', () => {
    /** Programme le scénario, et renvoie l'id de sa partie. */
    const scheduled = async (scenarioId: string, rank: number, tableName: string) => {
      const dto = (
        await schedule({ scenarioId, timeSlotId: slot(rank), tableId: table(tableName) }).expect(
          201,
        )
      ).body as ScheduleDto;
      return dto.games.find(({ scenario }) => scenario.id === scenarioId)!.id;
    };
    const move = (gameId: string, body: MoveGameBody | object) =>
      server().put(apiUrl(scheduleEndpoints.move, { gameId })).send(body);
    const swap = (gameId: string, body: SwapGamesBody | object) =>
      server().post(apiUrl(scheduleEndpoints.swap, { gameId })).send(body);
    const unschedule = (gameId: string) =>
      server().delete(apiUrl(scheduleEndpoints.unschedule, { gameId }));

    it('déplace une partie vers un autre créneau, puis vers une autre table, et renvoie le programme relu', async () => {
      const gameId = await scheduled(neons.id, 1, 'Table 1');

      await move(gameId, { timeSlotId: slot(2), tableId: table('Table 1') }).expect(200);
      const response = await move(gameId, {
        timeSlotId: slot(2),
        tableId: table('Table 2'),
      }).expect(200);

      const dto = response.body as ScheduleDto;
      expect(dto).toEqual(await read());
      expect(dto.games).toEqual([
        expect.objectContaining({
          id: gameId,
          tableId: table('Table 2'),
          timeSlotIds: [slot(2)],
          seats: { min: 3, max: 5 },
        }),
      ]);
      expect(placeOf(dto, 'Néons')).toEqual(['réserve', 'programmé']);
    });

    it.each([
      [
        'MJ indisponible',
        () => ({ timeSlotId: slot(2), tableId: table('Table 1') }),
        'game-master-unavailable',
        "Kaïros n'est pas disponible sur le créneau 2\u00a0: coche d'abord sa disponibilité sur sa fiche.",
      ],
      [
        'Table prise',
        () => ({ timeSlotId: slot(1), tableId: table('Table 1') }),
        'table-taken',
        'La table «\u00a0Table 1\u00a0» accueille déjà une partie sur le créneau 1\u00a0: choisis une autre table.',
      ],
    ])(
      'refuse « %s » : 422, avec le motif et la phrase (PR-5)',
      async (title, body, code, detail) => {
        await scheduled(neons.id, 1, 'Table 1');
        const gameId = await scheduled(brumes.id, 1, 'Table 2');

        const response = await move(gameId, body())
          .expect(422)
          .expect('Content-Type', /application\/problem\+json/);

        expect(response.body).toMatchObject({ code, title, detail });
        expect((await read()).games.find(({ id }) => id === gameId)!.tableId).toBe(
          table('Table 2'),
        );
      },
    );

    it('refuse « MJ déjà occupé » : 422', async () => {
      const gameId = await scheduled(neons.id, 1, 'Table 1');
      await scheduled(ruines.id, 2, 'Table 1');

      const response = await move(gameId, {
        timeSlotId: slot(2),
        tableId: table('Table 2'),
      }).expect(422);

      expect(response.body).toMatchObject({
        code: 'game-master-busy',
        title: 'MJ déjà occupé',
        detail: 'Élodie mène déjà une partie sur le créneau 2\u00a0: choisis un autre créneau.',
      });
    });

    it("donne la grille des verdicts de déplacement, sa propre case permise, et l'échange sur la case d'une autre partie", async () => {
      const neonsGameId = await scheduled(neons.id, 1, 'Table 1');
      const gameId = await scheduled(brumes.id, 1, 'Table 2');

      const response = await server()
        .get(apiUrl(scheduleEndpoints.movePlacements, { gameId }))
        .expect(200);

      expect(
        (response.body as MovePlacementDto[]).map(({ swapWith, refusal }) => [
          swapWith,
          refusal?.title ?? null,
        ]),
      ).toEqual([
        [neonsGameId, null],
        [null, null],
        [null, 'MJ indisponible'],
        [null, 'MJ indisponible'],
      ]);
    });

    describe('Échanger deux parties', () => {
      it('échange deux parties, chacune avec ses places, et renvoie le programme relu', async () => {
        const neonsGameId = await scheduled(neons.id, 2, 'Table 1');
        const ruinesGameId = await scheduled(ruines.id, 1, 'Table 2');

        const response = await swap(neonsGameId, { otherGameId: ruinesGameId }).expect(200);

        const dto = response.body as ScheduleDto;
        expect(dto).toEqual(await read());
        expect(dto.games).toEqual([
          expect.objectContaining({
            id: neonsGameId,
            tableId: table('Table 2'),
            timeSlotIds: [slot(1)],
            seats: { min: 3, max: 5 },
          }),
          expect.objectContaining({
            id: ruinesGameId,
            tableId: table('Table 1'),
            timeSlotIds: [slot(2)],
          }),
        ]);
      });

      it("refuse si l'une des deux ne peut pas prendre la place de l'autre : 422, sans rien changer (PR-5)", async () => {
        const neonsGameId = await scheduled(neons.id, 2, 'Table 1');
        const brumesGameId = await scheduled(brumes.id, 1, 'Table 2');
        const before = await read();

        const response = await swap(brumesGameId, { otherGameId: neonsGameId })
          .expect(422)
          .expect('Content-Type', /application\/problem\+json/);

        expect(response.body).toMatchObject({
          code: 'game-master-unavailable',
          title: 'MJ indisponible',
          detail:
            "Kaïros n'est pas disponible sur le créneau 2\u00a0: coche d'abord sa disponibilité sur sa fiche.",
        });
        expect(await read()).toEqual(before);
      });

      it('refuse une partie avec elle-même : 422', async () => {
        const gameId = await scheduled(neons.id, 1, 'Table 1');

        const response = await swap(gameId, { otherGameId: gameId }).expect(422);

        expect(response.body).toMatchObject({
          code: 'game-swapped-with-itself',
          title: 'Même partie',
          detail: "Une partie ne s'échange pas avec elle-même\u00a0: choisis une autre partie.",
        });
      });

      it('répond 404 à une partie inconnue, et 400 à un corps mal formé', async () => {
        const gameId = await scheduled(neons.id, 1, 'Table 1');

        await swap(UNKNOWN_ID, { otherGameId: gameId }).expect(404);
        await swap(gameId, { otherGameId: UNKNOWN_ID }).expect(404);
        await swap(gameId, {}).expect(400);
      });
    });

    describe('Échanger une partie double avec une partie simple', () => {
      const declare = (gameMasterId: string, rank: number) =>
        server()
          .put(apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId: slot(rank) }))
          .expect(200);

      /**
       * Un créneau 3 (17 h), sauf si `third` vaut `'none'`. « Abysses », double d'Élodie, sur
       * les créneaux 1 et 2 à la table 1 ; « Brumes » de Kaïros, disponible aussi sur le créneau 2,
       * sur le créneau 2 à la table 2. Élodie est disponible sur le créneau 3 si `third` vaut
       * `'available'`.
       */
      const withDoubleAndSimple = async (
        third: 'available' | 'unavailable' | 'none' = 'available',
      ) => {
        if (third !== 'none') {
          convention = (
            await server()
              .post(apiUrl(timeSlotEndpoints.add))
              .send({ start: '17:00', end: '19:30' })
              .expect(201)
          ).body as ConventionDto;
        }
        if (third === 'available') await declare(elodie.id, 3);
        await declare(kairos.id, 2);
        const abysses = await proposeScenario(elodie.id, 'Abysses', 2);
        return {
          doubleId: await scheduled(abysses.id, 1, 'Table 1'),
          simpleId: await scheduled(brumes.id, 2, 'Table 2'),
        };
      };

      it('accepte : la partie double prend le créneau de l’autre, et le suivant', async () => {
        const { doubleId, simpleId } = await withDoubleAndSimple();

        const dto = (await swap(doubleId, { otherGameId: simpleId }).expect(200))
          .body as ScheduleDto;

        expect(dto.games.find(({ id }) => id === doubleId)).toMatchObject({
          tableId: table('Table 2'),
          timeSlotIds: [slot(2), slot(3)],
        });
        expect(dto.games.find(({ id }) => id === simpleId)).toMatchObject({
          tableId: table('Table 1'),
          timeSlotIds: [slot(1)],
        });
      });

      it('refuse « Table prise » sur le créneau suivant : 422', async () => {
        const { doubleId, simpleId } = await withDoubleAndSimple();
        await server()
          .post(apiUrl(gameMasterEndpoints.add))
          .send({ nickname: 'Moïra' })
          .expect(201);
        const moira = (
          (await server().get(apiUrl(gameMasterEndpoints.list)).expect(200)).body as GameMasterDto[]
        ).find(({ nickname }) => nickname === 'Moïra')!;
        await declare(moira.id, 3);
        await scheduled((await proposeScenario(moira.id, 'Marées')).id, 3, 'Table 2');

        const response = await swap(simpleId, { otherGameId: doubleId }).expect(422);

        expect(response.body).toMatchObject({
          code: 'table-taken',
          detail:
            'La table «\u00a0Table 2\u00a0» accueille déjà une partie sur le créneau 3\u00a0: choisis une autre table.',
        });
      });

      it('refuse « MJ indisponible » sur le créneau suivant : 422', async () => {
        const { doubleId, simpleId } = await withDoubleAndSimple('unavailable');

        const response = await swap(doubleId, { otherGameId: simpleId }).expect(422);

        expect(response.body).toMatchObject({
          code: 'game-master-unavailable',
          detail:
            "Élodie n'est pas disponible sur le créneau 3\u00a0: coche d'abord sa disponibilité sur sa fiche.",
        });
      });

      it('refuse « Pas de créneau suivant » : 422', async () => {
        const { doubleId, simpleId } = await withDoubleAndSimple('none');

        const response = await swap(doubleId, { otherGameId: simpleId }).expect(422);

        expect(response.body).toMatchObject({
          code: 'no-next-time-slot',
          title: 'Pas de créneau suivant',
        });
      });
    });

    describe('Effets sur les inscriptions', () => {
      /** Un téléphone relié au pseudo, confirmé s'il existe déjà : son cookie, `nom=valeur`. */
      const linkedPhone = async (
        nickname: string,
        confirmation: IdentityConfirmationDto | null = null,
      ) => {
        const { presenceCode } = (await server().get(apiUrl(conventionEndpoints.read)).expect(200))
          .body as ConventionDto;
        const response = await server()
          .post(apiUrl(linkedPhoneEndpoints.link))
          .send({ presenceCode, nickname, confirmation })
          .expect(200);
        return (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      };
      const signUp = (gameId: string, cookie: string) =>
        server().put(apiUrl(signUpEndpoints.signUp, { gameId })).set('Cookie', cookie).expect(204);
      const signedUpGameIdsOf = async (cookie: string) =>
        (
          (await server().get(apiUrl(frontOfficeEndpoints.readSituation)).set('Cookie', cookie))
            .body as ParticipantSituationDto
        ).signedUpGameIds;
      const signUpCountOf = async (gameId: string, cookie: string) =>
        (
          (await server().get(apiUrl(frontOfficeEndpoints.readSchedule)).set('Cookie', cookie))
            .body as FrontOfficeScheduleDto
        ).games.find(({ id }) => id === gameId)!.signUpCount;

      it('une partie déprogrammée ou déplacée sur un autre créneau perd ses inscriptions, une autre table les garde (IN-6)', async () => {
        const neonsGameId = await scheduled(neons.id, 1, 'Table 1');
        const brumesGameId = await scheduled(brumes.id, 1, 'Table 2');
        const lune = await linkedPhone('Lune');
        await signUp(neonsGameId, lune);
        await signUp(brumesGameId, lune);

        await unschedule(brumesGameId).expect(200);
        expect(await signedUpGameIdsOf(lune)).toEqual([neonsGameId]);

        await move(neonsGameId, { timeSlotId: slot(1), tableId: table('Table 2') }).expect(200);
        expect(await signedUpGameIdsOf(lune)).toEqual([neonsGameId]);

        await move(neonsGameId, { timeSlotId: slot(2), tableId: table('Table 2') }).expect(200);
        expect(await signedUpGameIdsOf(lune)).toEqual([]);
        expect(await signUpCountOf(neonsGameId, lune)).toBe(0);
      });

      it('deux parties échangées entre deux créneaux perdent leurs inscriptions (IN-6)', async () => {
        const neonsGameId = await scheduled(neons.id, 2, 'Table 1');
        const ruinesGameId = await scheduled(ruines.id, 1, 'Table 2');
        const lune = await linkedPhone('Lune');
        await signUp(neonsGameId, lune);
        await signUp(ruinesGameId, lune);

        await swap(neonsGameId, { otherGameId: ruinesGameId }).expect(200);

        expect(await signedUpGameIdsOf(lune)).toEqual([]);
      });

      it('un MJ garde ses inscriptions sur le créneau où sa partie arrive, sans qu’elles comptent, et les retrouve quand elle en part (IN-4)', async () => {
        const brumesGameId = await scheduled(brumes.id, 1, 'Table 2');
        const elodiePhone = await linkedPhone('Élodie', 'game-master');
        const lune = await linkedPhone('Lune');
        await signUp(brumesGameId, elodiePhone);
        await signUp(brumesGameId, lune);

        const neonsGameId = await scheduled(neons.id, 1, 'Table 1');
        expect(await signUpCountOf(brumesGameId, lune)).toBe(1);
        expect(await signedUpGameIdsOf(elodiePhone)).toEqual([]);

        await move(neonsGameId, { timeSlotId: slot(2), tableId: table('Table 1') }).expect(200);
        expect(await signUpCountOf(brumesGameId, lune)).toBe(2);
        expect(await signedUpGameIdsOf(elodiePhone)).toEqual([brumesGameId]);
      });
    });

    it('un geste sur une partie laisse intacts les autres parties, les disponibilités et le reste de la convention', async () => {
      const neonsGameId = await scheduled(neons.id, 1, 'Table 1');
      const brumesGameId = await scheduled(brumes.id, 1, 'Table 2');
      const before = await rowWrites();

      await move(neonsGameId, { timeSlotId: slot(2), tableId: table('Table 1') }).expect(200);

      expect(await rowWrites()).toEqual({
        ...before,
        GameTimeSlot: {
          [`${brumesGameId}:${slot(1)}`]: before['GameTimeSlot']![`${brumesGameId}:${slot(1)}`],
          [`${neonsGameId}:${slot(2)}`]: expect.any(String),
        },
      });
    });

    it('déprogramme une partie : son scénario revient dans la réserve', async () => {
      const gameId = await scheduled(neons.id, 1, 'Table 1');

      const response = await unschedule(gameId).expect(200);

      const dto = response.body as ScheduleDto;
      expect(dto).toEqual(await read());
      expect(dto.games).toEqual([]);
      expect(placeOf(dto, 'Néons')).toEqual(['réserve', 'réserve']);
    });

    it('répond 404 à une partie inconnue, et 400 à un corps mal formé', async () => {
      const gameId = await scheduled(neons.id, 1, 'Table 1');
      const body = { timeSlotId: slot(2), tableId: table('Table 1') };

      for (const response of [
        await move(UNKNOWN_ID, body),
        await unschedule(UNKNOWN_ID),
        await server().get(apiUrl(scheduleEndpoints.movePlacements, { gameId: UNKNOWN_ID })),
      ]) {
        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({
          code: 'game-not-found',
          title: 'Partie introuvable',
        });
      }
      await move(gameId, { ...body, timeSlotId: UNKNOWN_ID }).expect(404);
      await move(gameId, { ...body, tableId: UNKNOWN_ID }).expect(404);
      await move(gameId, { timeSlotId: slot(2) }).expect(400);
    });
  });
});
