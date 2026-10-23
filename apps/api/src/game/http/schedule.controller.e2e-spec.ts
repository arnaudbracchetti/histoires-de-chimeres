import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  availabilityEndpoints,
  gameMasterEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type PlacementDto,
  type ScenarioDto,
  type ScheduleDto,
  type ScheduleGameBody,
  type ScenarioListItemDto,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

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
  const reserveTitles = (dto: ScheduleDto) =>
    dto.reserve.map(({ scenarioIds }) =>
      scenarioIds.map((id) => dto.scenarios.find((s) => s.id === id)!.title).sort(),
    );

  it('lit un programme vide, avec la réserve de chaque créneau (PR-6)', async () => {
    const dto = await read();

    expect(dto.games).toEqual([]);
    expect(reserveTitles(dto)).toEqual([
      ['Brumes', 'Néons', 'Ruines'],
      ['Néons', 'Ruines'],
    ]);
    expect(dto.scenarios.map(({ title }) => title)).toEqual(['Brumes', 'Néons', 'Ruines']);
    expect(dto.scenarios[0]).toMatchObject({ gameMaster: { id: kairos.id, nickname: 'Kaïros' } });
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
      "Kaïros n'est pas disponible sur le créneau 2 : coche d'abord sa disponibilité sur sa fiche.",
    ],
    [
      'MJ déjà occupé',
      () => ({ scenarioId: ruines.id, timeSlotId: slot(1), tableId: table('Table 2') }),
      'game-master-busy',
      'Élodie mène déjà une partie sur le créneau 1 : choisis un autre créneau.',
    ],
    [
      'Table prise',
      () => ({ scenarioId: brumes.id, timeSlotId: slot(1), tableId: table('Table 1') }),
      'table-taken',
      'La table « Table 1 » accueille déjà une partie sur le créneau 1 : choisis une autre table.',
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

  it('répond 404 à un scénario, un créneau ou une table inconnus', async () => {
    const base = { scenarioId: neons.id, timeSlotId: slot(1), tableId: table('Table 1') };

    await schedule({ ...base, scenarioId: UNKNOWN_ID }).expect(404);
    await schedule({ ...base, timeSlotId: UNKNOWN_ID }).expect(404);
    await schedule({ ...base, tableId: UNKNOWN_ID }).expect(404);
    await schedule({ scenarioId: neons.id }).expect(400);
  });

  it('refuse de supprimer un créneau ou une table qui porte une partie : 422 (PR-10)', async () => {
    await schedule({ scenarioId: neons.id, timeSlotId: slot(1), tableId: table('Table 1') }).expect(
      201,
    );

    const timeSlot = await server()
      .delete(apiUrl(timeSlotEndpoints.remove, { timeSlotId: slot(1) }))
      .expect(422);
    expect(timeSlot.body).toMatchObject({
      code: 'time-slot-has-games',
      title: 'Créneau programmé',
      detail: "Le créneau 1 porte une partie : déprogramme-la d'abord.",
    });
    const tableResponse = await server()
      .delete(apiUrl(tableEndpoints.remove, { tableId: table('Table 1') }))
      .expect(422);
    expect(tableResponse.body).toMatchObject({
      code: 'table-has-games',
      title: 'Table programmée',
      detail: "La table « Table 1 » porte une partie : déprogramme-la d'abord.",
    });
    await server()
      .delete(apiUrl(timeSlotEndpoints.remove, { timeSlotId: slot(2) }))
      .expect(200);
    await server()
      .delete(apiUrl(tableEndpoints.remove, { tableId: table('Table 2') }))
      .expect(200);
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
            'La table « Table 1 » accueille déjà une partie sur le créneau 1 : choisis une autre table.',
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
});
