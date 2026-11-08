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
  type FrontOfficeScheduleDto,
  type GameMasterDto,
  type ParticipantSituationDto,
  type PlacementDto,
  type ScenarioDto,
  type ScheduleDto,
  type SignUpTrackingDto,
} from '@chimeres/contract';
import type { Clock } from '@chimeres/application';
import { TimeOfDay, type DrawAlgorithm } from '@chimeres/domain';
import { startApp } from '../../../test/app.js';
import { CLOCK } from '../../clock/clock.token.js';
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

  /**
   * Démarre l'application, avec un autre algorithme de tirage et une autre horloge s'ils sont
   * donnés, puis la prépare.
   */
  const start = async (algorithm?: DrawAlgorithm, clock?: Clock) => {
    app = await startApp((builder) => {
      const withAlgorithm = algorithm
        ? builder.overrideProvider(DRAW_ALGORITHM).useValue(algorithm)
        : builder;
      return clock ? withAlgorithm.overrideProvider(CLOCK).useValue(clock) : withAlgorithm;
    });
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
          cancelled: false,
          playerCount: 2,
          belowMinimum: false,
          withoutPlayers: false,
          overMaximum: false,
          freeSeatCount: 2,
          surplusPlayerCount: 0,
          cancellable: false,
          gameMasterSignedUpGameIds: [],
        },
      ],
      assignments: [
        expect.objectContaining({ nickname: 'Lune', gameId: neons, movedByHand: false }),
        expect.objectContaining({ nickname: 'Sven', gameId: neons, movedByHand: false }),
      ],
      signals: [],
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

  it('programmer sur un créneau en tirage efface le tirage, que le verdict annonce (TI-6)', async () => {
    await start();
    const neons = await scheduled((await gameMaster('Élodie')).id, 'Néons', 'Table 10');
    await signUp(neons, await linkedPhone('Lune'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);
    const sven = await gameMaster('Sven');
    const scenario = (
      await server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: sven.id }))
        .send({
          title: 'Brumes',
          system: 'Cthulhu',
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats: { min: 2, max: 4 },
          duration: 1,
        })
        .expect(201)
    ).body as ScenarioDto;

    const placements = (
      await server()
        .get(apiUrl(scheduleEndpoints.placements, { scenarioId: scenario.id }))
        .expect(200)
    ).body as PlacementDto[];
    expect(
      placements.find(
        (placement) => placement.timeSlotId === slot(1) && placement.tableId === table('Table 2'),
      ),
    ).toMatchObject({ refusal: null, erasedDrawTimeSlotId: slot(1) });

    await server()
      .post(apiUrl(scheduleEndpoints.schedule))
      .send({ scenarioId: scenario.id, timeSlotId: slot(1), tableId: table('Table 2') })
      .expect(201);

    expect((await tracking()).timeSlots[0]).toMatchObject({ state: 'sign-ups-open', draw: null });
  });

  it('changer de table dans un créneau en tirage garde le tirage : le joueur suit sa partie', async () => {
    await start();
    const neons = await scheduled((await gameMaster('Élodie')).id, 'Néons', 'Table 10');
    await signUp(neons, await linkedPhone('Lune'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    await server()
      .put(apiUrl(scheduleEndpoints.move, { gameId: neons }))
      .send({ timeSlotId: slot(1), tableId: table('Table 2') })
      .expect(200);

    const first = (await tracking()).timeSlots[0]!;
    expect(first.state).toBe('drawing');
    expect(first.draw?.assignments).toMatchObject([{ nickname: 'Lune', gameId: neons }]);
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
  it('annule une partie : son MJ entre au tirage, et son inscription compte de nouveau (TI-6, IN-4)', async () => {
    await start();
    const elodie = await gameMaster('Élodie');
    const ondine = await gameMaster('Ondine');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    const lune = await linkedPhone('Lune');
    await signUp(neons, lune);
    // Ondine s'inscrit à « Néons », puis sa partie est programmée sur le même créneau.
    await signUp(neons, await linkedPhone('Ondine', 'game-master'));
    const marche = await scheduled(ondine.id, 'Le Marché', 'Table 2');
    const signUpCountOfNeons = async () =>
      (
        (
          await server()
            .get(apiUrl(frontOfficeEndpoints.readSchedule))
            .set('Cookie', lune)
            .expect(200)
        ).body as FrontOfficeScheduleDto
      ).games.find(({ id }) => id === neons)!.signUpCount;
    expect(await signUpCountOfNeons()).toBe(1);
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    await server()
      .put(apiUrl(drawEndpoints.cancelGame, { gameId: marche }))
      .expect(204);

    const cancelled = (await tracking()).timeSlots[0]!.draw!;
    expect(cancelled.games.find(({ gameId }) => gameId === marche)).toMatchObject({
      cancelled: true,
      gameMasterSignedUpGameIds: [neons],
    });
    expect(cancelled.assignments).toContainEqual(
      expect.objectContaining({ nickname: 'Ondine', gameId: null, signedUpGameIds: [neons] }),
    );
    expect(await signUpCountOfNeons()).toBe(2);

    await server()
      .delete(apiUrl(drawEndpoints.restoreGame, { gameId: marche }))
      .expect(204);

    const restored = (await tracking()).timeSlots[0]!.draw!;
    expect(restored.games.find(({ gameId }) => gameId === marche)).toMatchObject({
      cancelled: false,
    });
    expect(restored.assignments.map(({ nickname }) => nickname)).toEqual(['Lune']);
    expect(await signUpCountOfNeons()).toBe(1);
  });

  it('refuse d’annuler une partie à son minimum, en français', async () => {
    await start();
    const elodie = await gameMaster('Élodie');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    await signUp(neons, await linkedPhone('Lune'));
    await signUp(neons, await linkedPhone('Sven'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    const response = await server()
      .put(apiUrl(drawEndpoints.cancelGame, { gameId: neons }))
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'game-not-below-minimum',
      title: 'Partie au minimum',
      detail:
        "Cette partie a 2\u00a0joueurs pour 2\u00a0places au moins\u00a0: elle ne s'annule pas.",
    });
  });

  it('déplace un participant vers une partie où il n’est pas inscrit, puis le retire de sa table', async () => {
    await start();
    const elodie = await gameMaster('Élodie');
    const ondine = await gameMaster('Ondine');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    const marche = await scheduled(ondine.id, 'Le Marché', 'Table 2');
    await signUp(neons, await linkedPhone('Lune'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);
    const lune = (await tracking()).timeSlots[0]!.draw!.assignments[0]!;

    await server()
      .put(
        apiUrl(drawEndpoints.moveParticipant, {
          timeSlotId: slot(1),
          participantId: lune.participantId,
        }),
      )
      .send({ gameId: marche })
      .expect(204);

    expect((await tracking()).timeSlots[0]!.draw!.assignments).toEqual([
      expect.objectContaining({
        nickname: 'Lune',
        gameId: marche,
        movedByHand: true,
        playsWithoutSignUp: true,
      }),
    ]);

    await server()
      .put(
        apiUrl(drawEndpoints.moveParticipant, {
          timeSlotId: slot(1),
          participantId: lune.participantId,
        }),
      )
      .send({ gameId: null })
      .expect(204);

    expect((await tracking()).timeSlots[0]!.draw!.assignments).toEqual([
      expect.objectContaining({ nickname: 'Lune', gameId: null, movedByHand: true }),
    ]);
  });

  it('écrit en français un signal du tirage de chaque code (TI-5)', async () => {
    await start();
    await server().post(apiUrl(tableEndpoints.add)).send({ name: 'Table 3' }).expect(201);
    convention = (await server().get(apiUrl(conventionEndpoints.read)).expect(200))
      .body as ConventionDto;
    const neons = await scheduled((await gameMaster('Élodie')).id, 'Néons', 'Table 10');
    const marche = await scheduled((await gameMaster('Ondine')).id, 'Le Marché', 'Table 2');
    await scheduled((await gameMaster('Gaspard')).id, 'La Forge', 'Table 3');
    // Sept inscrits à « Néons », de 2 à 4 places : trois ne sont pas placés.
    for (const nickname of ['Lune', 'Sven', 'Mara', 'Nils', 'Pia', 'Tom', 'Yann']) {
      await signUp(neons, await linkedPhone(nickname));
    }
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);
    const unassigned = (await tracking()).timeSlots[0]!.draw!.assignments.filter(
      ({ gameId }) => gameId === null,
    );
    // L'un joue seul au « Marché », l'autre est le cinquième de « Néons ».
    for (const [index, gameId] of [marche, neons].entries()) {
      await server()
        .put(
          apiUrl(drawEndpoints.moveParticipant, {
            timeSlotId: slot(1),
            participantId: unassigned[index]!.participantId,
          }),
        )
        .send({ gameId })
        .expect(204);
    }

    expect((await tracking()).timeSlots[0]!.draw!.signals).toEqual([
      {
        code: 'participants-unassigned',
        level: 'danger',
        title: '1 non placé',
        detail: 'Il reste 7 places dans les parties du créneau.',
      },
      {
        code: 'games-without-players',
        level: 'danger',
        title: '1 partie sans joueur',
        detail: 'Annule-la pour publier le tirage.',
      },
      {
        code: 'games-below-minimum',
        level: 'warning',
        title: '1 partie sous son minimum',
        detail: "Maintenue : elle sera jouée ainsi, sauf si tu l'annules.",
      },
      {
        code: 'games-over-maximum',
        level: 'warning',
        title: '1 partie au-delà de son maximum',
        detail: '« Néons » : 5 joueurs pour 4 places.',
      },
    ]);
  });

  it('refuse de déplacer un participant vers une partie annulée, en français', async () => {
    await start();
    const elodie = await gameMaster('Élodie');
    const ondine = await gameMaster('Ondine');
    const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
    const marche = await scheduled(ondine.id, 'Le Marché', 'Table 2');
    await signUp(neons, await linkedPhone('Lune'));
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);
    await server()
      .put(apiUrl(drawEndpoints.cancelGame, { gameId: marche }))
      .expect(204);
    const lune = (await tracking()).timeSlots[0]!.draw!.assignments.find(
      ({ nickname }) => nickname === 'Lune',
    )!;

    const response = await server()
      .put(
        apiUrl(drawEndpoints.moveParticipant, {
          timeSlotId: slot(1),
          participantId: lune.participantId,
        }),
      )
      .send({ gameId: marche })
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'game-cancelled',
      title: 'Partie annulée',
      detail: "Cette partie est annulée\u00a0: rétablis-la d'abord.",
    });
  });

  it('refuse d’ajouter un créneau avant un créneau en tirage, en français (PR-11)', async () => {
    await start();
    await server()
      .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
      .expect(204);

    const response = await server()
      .post(apiUrl(timeSlotEndpoints.add))
      .send({ start: '07:00', end: '08:30' })
      .expect(422);

    expect(response.body).toMatchObject({
      code: 'time-slot-before-draw',
      title: 'Tirage lancé après',
      detail:
        "Le tirage du créneau 1 est lancé\u00a0: rouvre d'abord ses inscriptions pour placer un créneau avant lui.",
    });
  });

  describe('Publier le tirage (TI-7)', () => {
    const publish = (rank: number) =>
      server().post(apiUrl(drawEndpoints.publish, { timeSlotId: slot(rank) }));

    const situationOf = async (cookie: string) =>
      (
        await server()
          .get(apiUrl(frontOfficeEndpoints.readSituation))
          .set('Cookie', cookie)
          .expect(200)
      ).body as ParticipantSituationDto;

    const scheduleOf = async (cookie: string) =>
      (
        await server()
          .get(apiUrl(frontOfficeEndpoints.readSchedule))
          .set('Cookie', cookie)
          .expect(200)
      ).body as FrontOfficeScheduleDto;

    it('fige le tirage, puis le téléphone lit sa table, « pas de place », ses joueurs et le nombre de joueurs', async () => {
      await start();
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
      const lune = await linkedPhone('Lune');
      const sven = await linkedPhone('Sven');
      const elodiePhone = await linkedPhone('Élodie', 'game-master');
      await signUp(neons, lune);
      await signUp(neons, sven);
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);
      const svenId = (await tracking()).timeSlots[0]!.draw!.assignments.find(
        ({ nickname }) => nickname === 'Sven',
      )!.participantId;
      await server()
        .put(apiUrl(drawEndpoints.moveParticipant, { timeSlotId: slot(1), participantId: svenId }))
        .send({ gameId: null })
        .expect(204);
      expect((await scheduleOf(lune)).games[0]!.playerCount).toBeNull();

      await publish(1).expect(204);

      const first = (await tracking()).timeSlots[0]!;
      expect(first.state).toBe('published');
      expect(first.draw).toMatchObject({ published: true, assignedCount: 1, unassignedCount: 1 });
      expect((await situationOf(lune)).timeSlots[0]).toMatchObject({
        state: 'published',
        drawResult: { kind: 'assigned', gameId: neons },
      });
      expect((await situationOf(sven)).timeSlots[0]!.drawResult).toEqual({ kind: 'unassigned' });
      expect((await situationOf(elodiePhone)).timeSlots[0]!.drawResult).toEqual({
        kind: 'leading',
        players: ['Lune'],
      });
      expect((await scheduleOf(lune)).games[0]!.playerCount).toBe(1);
      const refused = await publish(1).expect(422);
      expect(refused.body).toMatchObject({ code: 'draw-published' });
    });

    it('termine le créneau publié une fois son heure de fin passée, pour le suivi comme pour le téléphone', async () => {
      // Le 14 mars 2027 à midi : le créneau 1 (9 h – 11 h 30) a fini, pas le créneau 2.
      await start(undefined, { now: () => ({ date: '2027-03-14', time: TimeOfDay.parse('12:00') }) });
      await server()
        .put(apiUrl(conventionEndpoints.update))
        .send({ name: convention.name, date: '2027-03-14' })
        .expect(200);
      const elodie = await gameMaster('Élodie');
      const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
      const lune = await linkedPhone('Lune');
      await signUp(neons, lune);
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);
      expect((await tracking()).timeSlots.map(({ state }) => state)).toEqual([
        'drawing',
        'sign-ups-open',
      ]);

      await publish(1).expect(204);

      expect((await tracking()).timeSlots.map(({ state }) => state)).toEqual([
        'ended',
        'sign-ups-open',
      ]);
      expect((await situationOf(lune)).timeSlots.map(({ state }) => state)).toEqual([
        'ended',
        'sign-ups-open',
      ]);
      expect((await situationOf(lune)).timeSlots[0]!.drawResult).toEqual({
        kind: 'assigned',
        gameId: neons,
      });
    });

    it('déprogramme une partie annulée : le téléphone ne la voit plus, son scénario revient dans la réserve (TI-7)', async () => {
      await start();
      const elodie = await gameMaster('Élodie');
      const ondine = await gameMaster('Ondine');
      const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
      const marche = await scheduled(ondine.id, 'Le Marché', 'Table 2');
      const lune = await linkedPhone('Lune');
      await signUp(neons, lune);
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);
      await server()
        .put(apiUrl(drawEndpoints.cancelGame, { gameId: marche }))
        .expect(204);

      await publish(1).expect(204);

      const games = (await scheduleOf(lune)).games;
      expect(games.map(({ id }) => id)).toEqual([neons]);
      expect(games[0]!.playerCount).toBe(1);
      const first = (await tracking()).timeSlots[0]!;
      expect(first.state).toBe('published');
      expect(first.draw!.assignments.map(({ nickname }) => nickname)).toEqual(['Lune', 'Ondine']);
      expect(first.draw!.games.map(({ gameId }) => gameId)).toEqual([neons]);
      const programme = (await server().get(apiUrl(scheduleEndpoints.read)).expect(200))
        .body as ScheduleDto;
      expect(programme.games.map(({ id }) => id)).toEqual([neons]);
      const reserved = programme.reserve.find(({ title }) => title === 'Le Marché')!;
      expect(reserved.timeSlots[0]).toMatchObject({ inReserve: true, scheduled: false });
    });

    it('refuse un tirage dont une partie n’a aucun joueur, en français', async () => {
      await start();
      const elodie = await gameMaster('Élodie');
      const ondine = await gameMaster('Ondine');
      const neons = await scheduled(elodie.id, 'Néons', 'Table 10');
      await scheduled(ondine.id, 'Le Marché', 'Table 2');
      await signUp(neons, await linkedPhone('Lune'));
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);

      const response = await publish(1).expect(422);

      expect(response.body).toMatchObject({
        code: 'games-without-players',
        title: 'Partie sans joueur',
        detail:
          "1\u00a0partie du créneau 1 n'a aucun joueur\u00a0: annule-la pour publier le tirage.",
      });
      expect((await tracking()).timeSlots[0]!.state).toBe('drawing');
    });

    it('fige le programme du créneau publié : verdict et geste refusés, en français', async () => {
      await start();
      const neons = await scheduled((await gameMaster('Élodie')).id, 'Néons', 'Table 10');
      await signUp(neons, await linkedPhone('Lune'));
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);
      await publish(1).expect(204);
      const published = {
        code: 'time-slot-published',
        title: 'Créneau publié',
        detail: 'Le tirage du créneau 1 est publié\u00a0: son programme ne change plus.',
      };

      const placements = (
        await server()
          .get(apiUrl(scheduleEndpoints.movePlacements, { gameId: neons }))
          .expect(200)
      ).body as PlacementDto[];
      expect(placements[0]!.refusal).toEqual(published);
      const refused = await server()
        .delete(apiUrl(scheduleEndpoints.unschedule, { gameId: neons }))
        .expect(422);
      expect(refused.body).toMatchObject(published);
    });

    it('refuse de supprimer un créneau publié, en français (PR-10)', async () => {
      await start();
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);
      await publish(1).expect(204);

      const response = await server()
        .delete(apiUrl(timeSlotEndpoints.remove, { timeSlotId: slot(1) }))
        .expect(422);

      expect(response.body).toMatchObject({
        code: 'time-slot-locked-by-draw',
        title: 'Créneau tiré',
        detail: 'Le tirage du créneau 1 est publié\u00a0: le créneau ne change plus.',
      });
    });

    it('n’a plus d’inscription active au créneau suivant pour le joueur placé dans une partie double (TI-3, IN-4)', async () => {
      await start();
      const elodie = await gameMaster('Élodie');
      const ondine = await gameMaster('Ondine');
      await server()
        .put(
          apiUrl(availabilityEndpoints.declare, { gameMasterId: elodie.id, timeSlotId: slot(2) }),
        )
        .expect(200);
      await server()
        .put(
          apiUrl(availabilityEndpoints.declare, { gameMasterId: ondine.id, timeSlotId: slot(2) }),
        )
        .expect(200);
      const epice = (
        await server()
          .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: elodie.id }))
          .send({
            title: 'Épice',
            system: 'Dune',
            presentation: 'Une partie double.',
            contentWarnings: '',
            seats: { min: 1, max: 4 },
            duration: 2,
          })
          .expect(201)
      ).body as ScenarioDto;
      const games = (
        await server()
          .post(apiUrl(scheduleEndpoints.schedule))
          .send({ scenarioId: epice.id, timeSlotId: slot(1), tableId: table('Table 10') })
          .expect(201)
      ).body as ScheduleDto;
      const epiceGame = games.games.find((game) => game.scenario.id === epice.id)!.id;
      const songe = (
        await server()
          .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: ondine.id }))
          .send({
            title: 'Songe',
            system: 'Rêve de dragon',
            presentation: 'Un rêve.',
            contentWarnings: '',
            seats: { min: 1, max: 4 },
            duration: 1,
          })
          .expect(201)
      ).body as ScenarioDto;
      const songeGame = (
        (
          await server()
            .post(apiUrl(scheduleEndpoints.schedule))
            .send({ scenarioId: songe.id, timeSlotId: slot(2), tableId: table('Table 2') })
            .expect(201)
        ).body as ScheduleDto
      ).games.find((game) => game.scenario.id === songe.id)!.id;
      const lune = await linkedPhone('Lune');
      await signUp(epiceGame, lune);
      await signUp(songeGame, lune);
      await signUp(songeGame, await linkedPhone('Sven'));
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(1) }))
        .expect(204);
      expect((await tracking()).timeSlots[1]!.demand).toBe(2);

      await publish(1).expect(204);

      const second = (await tracking()).timeSlots[1]!;
      expect(second.demand).toBe(1);
      expect(second.participants.map(({ nickname }) => nickname)).toEqual(['Sven']);
      expect((await scheduleOf(lune)).games.find(({ id }) => id === songeGame)!.signUpCount).toBe(
        1,
      );
      await server()
        .post(apiUrl(drawEndpoints.launch, { timeSlotId: slot(2) }))
        .expect(204);
      expect(
        (await tracking()).timeSlots[1]!.draw!.assignments.map(({ nickname }) => nickname),
      ).toEqual(['Sven']);
    });
  });
});
