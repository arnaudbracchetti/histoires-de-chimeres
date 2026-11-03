import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  drawEndpoints,
  frontOfficeEndpoints,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  signUpEndpoints,
  signUpTrackingEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type ParticipantSituationDto,
  type ScenarioDto,
  type ScheduleDto,
  type SignUpTrackingDto,
} from '@chimeres/contract';
import type { DrawAlgorithm } from '@chimeres/domain';
import { startApp } from '../../../test/app.js';
import { DRAW_ALGORITHM } from '../draw-algorithm.token.js';

describe('Les gestes du tirage (TI-1, TI-6)', () => {
  let app: INestApplication<App>;
  /** Créneaux 1 (9 h – 11 h 30) et 2 (14 h – 16 h 30), tables « Table 10 » et « Table 2 ». */
  let convention: ConventionDto;

  const server = () => request(app.getHttpServer());
  const slot = (rank: number) => convention.timeSlots[rank - 1]!.id;
  const table = (name: string) => convention.tables.find((t) => t.name === name)!.id;

  /** Un MJ disponible sur le créneau 1. */
  const gameMaster = async (nickname: string) => {
    const added = (
      (await server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname }).expect(201))
        .body as GameMasterDto[]
    ).find((candidate) => candidate.nickname === nickname)!;
    await server()
      .put(apiUrl(availabilityEndpoints.declare, { gameMasterId: added.id, timeSlotId: slot(1) }))
      .expect(200);
    return added;
  };

  /** Programme un scénario du MJ au créneau 1, de 2 à 4 places, à la table : l'id de la partie. */
  const scheduled = async (gameMasterId: string, title: string, tableName: string) => {
    const scenario = (
      await server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId }))
        .send({
          title,
          system: 'Cthulhu',
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats: { min: 2, max: 4 },
          duration: 1,
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

  /**
   * Un téléphone relié au pseudo, celui d'un MJ avec sa confirmation : son cookie, `nom=valeur`.
   */
  const linkedPhone = async (nickname: string, confirmation: 'game-master' | null = null) => {
    const response = await server()
      .post(apiUrl(linkedPhoneEndpoints.link))
      .send({ presenceCode: convention.presenceCode, nickname, confirmation })
      .expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  };

  const signUp = (gameId: string, cookie: string) =>
    server().put(apiUrl(signUpEndpoints.signUp, { gameId })).set('Cookie', cookie).expect(204);

  const tracking = async () =>
    (await server().get(apiUrl(signUpTrackingEndpoints.read)).expect(200))
      .body as SignUpTrackingDto;

  /** Démarre l'application, avec un autre algorithme de tirage s'il est donné, puis la prépare. */
  const start = async (algorithm?: DrawAlgorithm) => {
    app = await startApp((builder) =>
      algorithm ? builder.overrideProvider(DRAW_ALGORITHM).useValue(algorithm) : builder,
    );
    for (const [start, end] of [
      ['09:00', '11:30'],
      ['14:00', '16:30'],
    ]) {
      await server().post(apiUrl(timeSlotEndpoints.add)).send({ start, end }).expect(201);
    }
    for (const name of ['Table 10', 'Table 2']) {
      await server().post(apiUrl(tableEndpoints.add)).send({ name }).expect(201);
    }
    convention = (await server().get(apiUrl(conventionEndpoints.read)).expect(200))
      .body as ConventionDto;
  };

  afterEach(async () => {
    await app.close();
  });

  it('ferme les inscriptions, puis le suivi relit le tirage sauvegardé', async () => {
    await start();
    const elodie = await gameMaster('Élodie');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    const lune = await linkedPhone('Lune');
    const sven = await linkedPhone('Sven');
    await signUp(neons, lune);
    await signUp(neons, sven);

    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    const first = (await tracking()).timeSlots[0]!;
    expect(first.state).toBe('drawing');
    expect(first.warnings).toEqual([]);
    expect(first.draw).toEqual({
      published: false,
      participantCount: 2,
      assignedCount: 2,
      unassignedCount: 0,
      gameCount: 1,
      gamesAtMinimumCount: 1,
      freeSeatCount: 2,
      tablesWithSeats: [{ tableId: table('Table 10'), name: 'Table 10', freeSeatCount: 2 }],
      games: [
        {
          gameId: neons,
          playerCount: 2,
          belowMinimum: false,
          withoutPlayers: false,
          overMaximum: false,
          freeSeatCount: 2,
          surplusPlayerCount: 0,
        },
      ],
      assignments: [
        expect.objectContaining({ nickname: 'Lune', gameId: neons, movedByHand: false }),
        expect.objectContaining({ nickname: 'Sven', gameId: neons, movedByHand: false }),
      ],
    });
    expect((await tracking()).timeSlots[1]!.draw).toBeNull();
    const ondine = await linkedPhone('Ondine');
    const refused = await server()
      .put(apiUrl(signUpEndpoints.signUp, { gameId: neons }))
      .set('Cookie', ondine)
      .expect(422);
    expect(refused.body).toMatchObject({ code: 'sign-ups-closed' });
    // Le téléphone voit « Tirage en cours », sans résultat provisoire.
    const situation = (
      await server().get(apiUrl(frontOfficeEndpoints.readSituation)).set('Cookie', lune).expect(200)
    ).body as ParticipantSituationDto;
    expect(situation.timeSlots[0]).toMatchObject({ state: 'drawing', drawResult: null });
  });

  it('refuse un créneau qui suit un créneau au tirage non publié, en français', async () => {
    await start();

    const response = await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(2) }))
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'previous-draw-not-published',
      title: 'Tirage précédent à publier',
      detail: 'Le tirage du créneau 2 se lance après la publication du créneau 1.',
    });
  });

  it('refuse un tirage déjà lancé', async () => {
    await start();
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    const response = await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'draw-already-launched',
      detail: 'Le tirage du créneau 1 est déjà lancé.',
    });
  });

  it('rend une erreur 500 pour une sortie fautive de l’algorithme, sans rien sauvegarder', async () => {
    await start({ computeAssignments: () => [] });
    const elodie = await gameMaster('Élodie');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    await signUp(neons, await linkedPhone('Lune'));

    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(500);

    expect((await tracking()).timeSlots[0]).toMatchObject({ state: 'sign-ups-open', draw: null });
  });

  it('efface les affectations d’un MJ supprimé (PR-12)', async () => {
    await start();
    const elodie = await gameMaster('Élodie');
    const ondine = await gameMaster('Ondine');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    await signUp(neons, await linkedPhone('Lune'));
    // Ondine, MJ sans scénario, s'inscrit comme participante.
    await signUp(neons, await linkedPhone('Ondine', 'game-master'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    await server()
      .delete(apiUrl(gameMasterEndpoints.remove, { gameMasterId: ondine.id }))
      .expect(204);

    expect(
      (await tracking()).timeSlots[0]!.draw!.assignments.map(({ nickname }) => nickname),
    ).toEqual(['Lune']);
  });
  /** Un algorithme qui ne place personne au premier appel, puis chacun sur sa première partie. */
  const placesOnRerun = (): DrawAlgorithm => {
    let calls = 0;
    return {
      computeAssignments: ({ participants }) =>
        participants.map(({ id, gameIds }) => ({
          participantId: id,
          gameId: calls++ < participants.length ? null : (gameIds[0] ?? null),
        })),
    };
  };

  it('relance le tirage : un nouveau tirage, inscriptions toujours fermées', async () => {
    await start(placesOnRerun());
    const elodie = await gameMaster('Élodie');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    await signUp(neons, await linkedPhone('Lune'));
    await signUp(neons, await linkedPhone('Sven'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    await server()
      .post(apiUrl(drawEndpoints.rerun, { timeSlotId: slot(1) }))
      .expect(204);

    expect((await tracking()).timeSlots[0]).toMatchObject({
      state: 'drawing',
      draw: { participantCount: 2, assignedCount: 2 },
    });
  });

  it('rouvre les inscriptions : le tirage est effacé, on s’inscrit de nouveau', async () => {
    await start();
    const elodie = await gameMaster('Élodie');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    await signUp(neons, await linkedPhone('Lune'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    await server()
      .delete(apiUrl(drawEndpoints.reopenSignUps, { timeSlotId: slot(1) }))
      .expect(204);

    expect((await tracking()).timeSlots[0]).toMatchObject({ state: 'sign-ups-open', draw: null });
    await signUp(neons, await linkedPhone('Sven'));
  });

  it('refuse de relancer ou de rouvrir un tirage pas lancé, en français', async () => {
    await start();

    const rerun = await server()
      .post(apiUrl(drawEndpoints.rerun, { timeSlotId: slot(1) }))
      .expect(422);
    const reopen = await server()
      .delete(apiUrl(drawEndpoints.reopenSignUps, { timeSlotId: slot(1) }))
      .expect(422);

    for (const response of [rerun, reopen]) {
      expect(response.body).toMatchObject({
        code: 'draw-not-launched',
        title: 'Tirage pas lancé',
        detail: "Le tirage du créneau 1 n'est pas lancé.",
      });
    }
  });
});
