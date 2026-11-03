import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { Convention } from './convention.js';
import { Assignment, Draw } from './draw.js';
import { FaultyDrawOutputError } from './draws.js';
import type { DrawAlgorithm, DrawInput, DrawOutput } from './draw-algorithm.js';
import type { LocalMoment } from './local-moment.js';
import { ParticipantWithoutGame } from './participant-without-game.js';
import { PresenceCode } from './presence-code.js';
import { TimeOfDay } from './time-of-day.js';

// Les règles des Tirages (module `Draws`), à travers `Convention` : son interface est la surface de test.

const at = TimeOfDay.parse;
const NOW: LocalMoment = { date: '2027-03-14', time: at('08:00') };

function aScenario(id: string, gameMasterId: string, duration: Duration = 1): Scenario {
  return Scenario.propose(id, gameMasterId, {
    title: `Scénario ${id}`,
    system: 'Cthulhu',
    presentation: 'Une enquête.',
    contentWarnings: '',
    seats: { min: 3, max: 5 },
    duration,
  });
}

/**
 * Créneaux s1, s2 et s3, tables t1 et t2. Au créneau 1 : « brumes » (t1, MJ Brann) et « épice »,
 * partie double des créneaux 1 et 2 (t2, MJ Kaïros). Au créneau 2 : « néons » (t1, MJ Brann). Le
 * créneau 3 n'a pas de partie. Les participants « Élodie » (p1), « Lune » (p2) et « Zéphyr » (p3)
 * se sont identifiés.
 */
function aConvention(): Convention {
  const convention = Convention.restore({
    id: 'c1',
    name: 'Histoires de Chimères',
    date: null,
    timeSlots: [],
    tables: [],
    gameMasters: [],
    participants: [],
    signUps: [],
    participantsWithoutGame: [],
    draws: [],
    games: [],
    version: 0,
    presenceCode: PresenceCode.parse('K7M2'),
  });
  convention.addTimeSlot('s1', at('09:00'), at('11:30'));
  convention.addTimeSlot('s2', at('14:00'), at('16:30'));
  convention.addTimeSlot('s3', at('17:00'), at('19:30'));
  convention.addTable('t1', 'Table 1');
  convention.addTable('t2', 'Table 2');
  convention.addGameMaster('g1', 'p-g1', 'Brann');
  convention.addGameMaster('g2', 'p-g2', 'Kaïros');
  for (const slot of ['s1', 's2']) {
    convention.declareGameMasterAvailability('g1', slot);
    convention.declareGameMasterAvailability('g2', slot);
  }
  convention.scheduleScenario('brumes', aScenario('a', 'g1'), 's1', 't1');
  convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
  convention.scheduleScenario('neons', aScenario('c', 'g1'), 's2', 't1');
  convention.identifyByNickname('p1', 'K7M2', 'Élodie', null, NOW);
  convention.identifyByNickname('p2', 'K7M2', 'Lune', null, NOW);
  convention.identifyByNickname('p3', 'K7M2', 'Zéphyr', null, NOW);
  return convention;
}

/** Les scénarios a et c, de 3 à 5 places, et b, de 2 à 4. */
const CATALOGUE = ScenarioCatalogue.restore([
  { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
  { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 2, maxSeats: 4 },
  { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
]);

const RANDOM = () => 0.5;

/**
 * Un faux algorithme réglable : il retient son entrée, et rend la sortie que le test lui donne, ou
 * personne de placé.
 */
class FakeDrawAlgorithm implements DrawAlgorithm {
  received: DrawInput | null = null;

  constructor(private readonly output?: (input: DrawInput) => DrawOutput) {}

  computeAssignments(input: DrawInput): DrawOutput {
    this.received = input;
    return this.output
      ? this.output(input)
      : input.participants.map(({ id }) => ({ participantId: id, gameId: null }));
  }
}

/** Un algorithme qui place chacun sur la première partie de ses inscriptions. */
const FIRST_GAME = new FakeDrawAlgorithm((input) =>
  input.participants.map(({ id, gameIds }) => ({ participantId: id, gameId: gameIds[0] ?? null })),
);

function refusalOf(action: () => void): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error("L'action n'a pas été refusée.");
}

/** Les affectations du tirage du créneau, en « participant partie », la partie `-` pour un non placé. */
function assignmentsOf(convention: Convention, timeSlotId: string): string[] {
  const draw = convention.draws.find((candidate) => candidate.timeSlotId === timeSlotId);
  return (draw?.assignments ?? []).map(
    ({ participantId, gameId }) => `${participantId} ${gameId ?? '-'}`,
  );
}

/** La même convention, avec ces tirages : la publication n'existe pas encore comme geste. */
function restoreWithDraws(convention: Convention, draws: Draw[]): Convention {
  return Convention.restore({
    id: convention.id,
    name: convention.name,
    date: convention.date,
    timeSlots: [...convention.timeSlots],
    tables: [...convention.tables],
    gameMasters: [...convention.gameMasters],
    participants: [...convention.participants],
    signUps: [...convention.signUps],
    participantsWithoutGame: [...convention.participantsWithoutGame],
    draws,
    games: [...convention.games],
    version: convention.version,
    presenceCode: convention.presenceCode,
  });
}

const stateOf = (convention: Convention, timeSlotId: string) =>
  convention
    .computeParticipantSituation('p1')
    .timeSlots.find((slot) => slot.timeSlotId === timeSlotId)?.state;

describe('Lancer le tirage (TI-1)', () => {
  it('ferme les inscriptions du créneau, et de lui seul', () => {
    const convention = aConvention();

    convention.launchDraw('s1', CATALOGUE, new FakeDrawAlgorithm(), RANDOM);

    expect(stateOf(convention, 's1')).toBe('drawing');
    expect(stateOf(convention, 's2')).toBe('sign-ups-open');
  });

  it('refuse ensuite l’inscription et la désinscription sur le créneau (IN-2)', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, new FakeDrawAlgorithm(), RANDOM);

    expect(refusalOf(() => convention.signUpForGame('p2', 'brumes', CATALOGUE))).toMatchObject({
      code: 'sign-ups-closed',
      params: { rank: 1 },
    });
    expect(refusalOf(() => convention.withdrawFromGame('p1', 'brumes')).code).toBe(
      'sign-ups-closed',
    );
  });

  it('enregistre l’affectation que l’algorithme rend à chaque participant', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);

    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    expect(assignmentsOf(convention, 's1')).toEqual(['p1 brumes', 'p2 epice']);
    expect(convention.draws[0]).toMatchObject({ timeSlotId: 's1', published: false });
    expect(convention.draws[0]!.assignments.every(({ movedByHand }) => !movedByHand)).toBe(true);
  });

  it('donne à l’algorithme les parties qui commencent sur le créneau, avec leurs places, et la source de hasard', () => {
    const convention = aConvention();
    let receivedRandom: (() => number) | null = null;
    const algorithm: DrawAlgorithm = {
      computeAssignments(input, random) {
        receivedRandom = random;
        expect(input.games).toEqual([
          { id: 'brumes', minSeats: 3, maxSeats: 5 },
          { id: 'epice', minSeats: 2, maxSeats: 4 },
        ]);
        return [];
      },
    };

    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);

    expect(receivedRandom).toBe(RANDOM);
  });

  it('donne à l’algorithme chaque participant inscrit, avec ses inscriptions du créneau', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p1', 'neons', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm();

    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);

    expect(algorithm.received?.participants).toEqual([
      { id: 'p1', gameIds: ['brumes', 'epice'] },
      { id: 'p2', gameIds: ['epice'] },
    ]);
  });

  it('laisse hors du tirage le MJ qui mène sur le créneau, malgré son inscription (TI-2, IN-4)', () => {
    const convention = aConvention();
    convention.unscheduleGame('epice');
    convention.signUpForGame('p-g2', 'brumes', CATALOGUE);
    convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
    const algorithm = new FakeDrawAlgorithm();

    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);

    expect(algorithm.received?.participants).toEqual([]);
  });

  it('lance un créneau sans partie, avec un résultat vide', () => {
    const published = restoreWithDraws(aConvention(), [
      new Draw('s1', true, []),
      new Draw('s2', true, []),
    ]);

    published.launchDraw('s3', CATALOGUE, new FakeDrawAlgorithm(), RANDOM);

    expect(stateOf(published, 's3')).toBe('drawing');
    expect(assignmentsOf(published, 's3')).toEqual([]);
  });
});

describe('Lancer le tirage : refus, dans l’ordre', () => {
  it('refuse un créneau dont le tirage est déjà lancé', () => {
    const convention = aConvention();
    convention.launchDraw('s1', CATALOGUE, new FakeDrawAlgorithm(), RANDOM);

    expect(
      refusalOf(() => convention.launchDraw('s1', CATALOGUE, new FakeDrawAlgorithm(), RANDOM)),
    ).toMatchObject({ code: 'draw-already-launched', params: { rank: 1 } });
  });

  it('refuse un créneau dont le tirage est publié', () => {
    const convention = restoreWithDraws(aConvention(), [new Draw('s1', true, [])]);

    expect(
      refusalOf(() => convention.launchDraw('s1', CATALOGUE, new FakeDrawAlgorithm(), RANDOM)),
    ).toMatchObject({ code: 'draw-published', params: { rank: 1 } });
  });

  it('refuse un créneau qu’un créneau au tirage non publié précède, en nommant le premier', () => {
    const convention = restoreWithDraws(aConvention(), [new Draw('s1', false, [])]);

    expect(
      refusalOf(() => convention.launchDraw('s3', CATALOGUE, new FakeDrawAlgorithm(), RANDOM)),
    ).toMatchObject({ code: 'previous-draw-not-published', params: { rank: 3, previousRank: 1 } });
  });

  it('lance le créneau qui suit un créneau publié', () => {
    const convention = restoreWithDraws(aConvention(), [new Draw('s1', true, [])]);

    convention.launchDraw('s2', CATALOGUE, new FakeDrawAlgorithm(), RANDOM);

    expect(stateOf(convention, 's2')).toBe('drawing');
  });

  it('refuse un créneau introuvable', () => {
    expect(
      refusalOf(() =>
        aConvention().launchDraw('inconnu', CATALOGUE, new FakeDrawAlgorithm(), RANDOM),
      ).code,
    ).toBe('time-slot-not-found');
  });
});

describe('Lancer le tirage : sortie fautive de l’algorithme', () => {
  /** Élodie inscrite à « brumes », Lune à « épice ». */
  function aConventionWithSignUps(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    return convention;
  }

  it.each<[string, DrawOutput]>([
    ['un participant manquant', [{ participantId: 'p1', gameId: 'brumes' }]],
    [
      'un participant en double',
      [
        { participantId: 'p1', gameId: 'brumes' },
        { participantId: 'p1', gameId: null },
        { participantId: 'p2', gameId: null },
      ],
    ],
    [
      'un participant en trop',
      [
        { participantId: 'p1', gameId: null },
        { participantId: 'p2', gameId: null },
        { participantId: 'p3', gameId: null },
      ],
    ],
    [
      'une partie hors de ses inscriptions',
      [
        { participantId: 'p1', gameId: 'epice' },
        { participantId: 'p2', gameId: 'epice' },
      ],
    ],
  ])('lève une erreur interne pour %s, et rien ne change', (_, output) => {
    const convention = aConventionWithSignUps();

    expect(() =>
      convention.launchDraw('s1', CATALOGUE, new FakeDrawAlgorithm(() => output), RANDOM),
    ).toThrow(FaultyDrawOutputError);
    expect(convention.draws).toEqual([]);
    expect(stateOf(convention, 's1')).toBe('sign-ups-open');
  });

  it('lève une erreur interne pour une partie au-delà de son maximum', () => {
    const convention = aConvention();
    const catalogue = ScenarioCatalogue.restore([
      { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 1, maxSeats: 1 },
      { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 2, maxSeats: 4 },
      { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
    ]);
    convention.signUpForGame('p1', 'brumes', catalogue);
    convention.signUpForGame('p2', 'brumes', catalogue);

    expect(() => convention.launchDraw('s1', catalogue, FIRST_GAME, RANDOM)).toThrow(
      FaultyDrawOutputError,
    );
  });
});

describe('Supprimer un MJ (PR-12)', () => {
  it('efface ses affectations de tous les tirages', () => {
    const convention = aConvention();
    convention.addGameMaster('g3', 'p-g3', 'Ondine');
    convention.signUpForGame('p-g3', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    convention.removeGameMaster('g3', CATALOGUE);

    expect(assignmentsOf(convention, 's1')).toEqual(['p1 brumes']);
  });
});

describe('Lancer le tirage : partie double (TI-3)', () => {
  /**
   * Élodie et Lune inscrites à « épice », partie double des créneaux 1 et 2, et à « néons », au
   * créneau 2. Au tirage du créneau 1, Élodie est placée à « épice », Lune ne l'est pas.
   */
  function aConventionWithFirstDraw(published: boolean): Convention {
    const convention = aConvention();
    for (const participantId of ['p1', 'p2']) {
      convention.signUpForGame(participantId, 'epice', CATALOGUE);
      convention.signUpForGame(participantId, 'neons', CATALOGUE);
    }
    return restoreWithDraws(convention, [
      new Draw('s1', published, [
        new Assignment('p1', 'epice', false),
        new Assignment('p2', null, false),
      ]),
    ]);
  }

  it('laisse hors du tirage suivant le joueur placé dans une partie double publiée', () => {
    const convention = aConventionWithFirstDraw(true);
    const algorithm = new FakeDrawAlgorithm();

    convention.launchDraw('s2', CATALOGUE, algorithm, RANDOM);

    expect(algorithm.received?.participants).toEqual([{ id: 'p2', gameIds: ['neons'] }]);
  });

  it('garde actives ses inscriptions du créneau suivant tant que le tirage est provisoire', () => {
    const convention = aConventionWithFirstDraw(false);

    expect(convention.computeParticipantSituation('p1').signedUpGameIds).toEqual([
      'epice',
      'neons',
    ]);
  });

  it('garde active son inscription à la partie double elle-même', () => {
    const convention = aConventionWithFirstDraw(true);

    expect(convention.computeParticipantSituation('p1').signedUpGameIds).toEqual(['epice']);
  });
});

describe('Suivi d’un créneau lancé', () => {
  const trackingOf = (convention: Convention, timeSlotId: string) =>
    convention.computeSignUpTracking(CATALOGUE).find((slot) => slot.timeSlotId === timeSlotId)!;

  it('n’a pas de tirage tant que le créneau n’est pas lancé', () => {
    expect(trackingOf(aConvention(), 's1').draw).toBeNull();
  });

  it('porte les chiffres du tirage, ses parties et ses affectations', () => {
    const convention = aConvention();
    // Zéphyr à « brumes » (3 à 5 places) ; Élodie et Lune à « épice » (2 à 4 places), Élodie aussi à « brumes ».
    convention.signUpForGame('p3', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm(() => [
      { participantId: 'p3', gameId: 'brumes' },
      { participantId: 'p1', gameId: 'epice' },
      { participantId: 'p2', gameId: null },
    ]);

    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);

    const tracking = trackingOf(convention, 's1');
    expect(tracking.warnings).toEqual([]);
    expect(tracking.draw).toEqual({
      published: false,
      participantCount: 3,
      assignedCount: 2,
      unassignedCount: 1,
      gameCount: 2,
      gamesAtMinimumCount: 0,
      freeSeatCount: 7,
      tablesWithSeats: [
        { tableId: 't1', freeSeatCount: 4 },
        { tableId: 't2', freeSeatCount: 3 },
      ],
      games: [
        {
          gameId: 'brumes',
          cancelled: false,
          playerCount: 1,
          belowMinimum: true,
          withoutPlayers: false,
          overMaximum: false,
          freeSeatCount: 4,
          surplusPlayerCount: 0,
          cancellable: true,
          gameMasterSignedUpGameIds: [],
        },
        {
          gameId: 'epice',
          cancelled: false,
          playerCount: 1,
          belowMinimum: true,
          withoutPlayers: false,
          overMaximum: false,
          freeSeatCount: 3,
          surplusPlayerCount: 0,
          cancellable: true,
          gameMasterSignedUpGameIds: [],
        },
      ],
      // Dans l'ordre naturel des pseudos.
      assignments: [
        {
          participantId: 'p1',
          gameId: 'epice',
          movedByHand: false,
          signedUpGameIds: ['epice', 'brumes'],
          playsWithoutSignUp: false,
        },
        {
          participantId: 'p2',
          gameId: null,
          movedByHand: false,
          signedUpGameIds: ['epice'],
          playsWithoutSignUp: false,
        },
        {
          participantId: 'p3',
          gameId: 'brumes',
          movedByHand: false,
          signedUpGameIds: ['brumes'],
          playsWithoutSignUp: false,
        },
      ],
    });
  });

  it('compte une partie sans joueur, une partie à son minimum, et une au-delà de son maximum', () => {
    const catalogue = ScenarioCatalogue.restore([
      { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 1, maxSeats: 1 },
      { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 2, maxSeats: 4 },
      { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
    ]);
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', catalogue);
    convention.launchDraw('s1', catalogue, FIRST_GAME, RANDOM);
    // Lune et Zéphyr joueraient à « brumes », sans inscription, après des déplacements à la main.
    const moved = restoreWithDraws(convention, [
      new Draw('s1', false, [
        new Assignment('p1', 'brumes', false),
        new Assignment('p2', 'brumes', true),
      ]),
    ]);

    const draw = moved
      .computeSignUpTracking(catalogue)
      .find((slot) => slot.timeSlotId === 's1')!.draw!;

    expect(draw).toMatchObject({ gameCount: 2, gamesAtMinimumCount: 1, freeSeatCount: 4 });
    expect(draw.tablesWithSeats).toEqual([{ tableId: 't2', freeSeatCount: 4 }]);
    expect(draw.games).toEqual([
      expect.objectContaining({
        gameId: 'brumes',
        playerCount: 2,
        belowMinimum: false,
        overMaximum: true,
        freeSeatCount: 0,
        surplusPlayerCount: 1,
      }),
      expect.objectContaining({
        gameId: 'epice',
        playerCount: 0,
        withoutPlayers: true,
        belowMinimum: false,
      }),
    ]);
    expect(draw.assignments[1]).toEqual({
      participantId: 'p2',
      gameId: 'brumes',
      movedByHand: true,
      signedUpGameIds: [],
      playsWithoutSignUp: true,
    });
  });

  it('montre une partie annulée, hors des chiffres, avec les inscriptions de son MJ', () => {
    const convention = aConvention();
    convention.unscheduleGame('epice');
    convention.signUpForGame('p-g2', 'brumes', CATALOGUE);
    convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    // Avant l'annulation, l'inscription du MJ ne compte pas (IN-4), mais la confirmation la nomme.
    expect(trackingOf(convention, 's1').draw!.games[1]).toMatchObject({
      gameId: 'epice',
      cancelled: false,
      gameMasterSignedUpGameIds: ['brumes'],
    });

    convention.cancelGame('epice', CATALOGUE);

    const draw = trackingOf(convention, 's1').draw!;
    expect(draw).toMatchObject({
      participantCount: 2,
      gameCount: 1,
      gamesAtMinimumCount: 0,
      freeSeatCount: 4,
      tablesWithSeats: [{ tableId: 't1', freeSeatCount: 4 }],
    });
    expect(draw.games[1]).toEqual({
      gameId: 'epice',
      cancelled: true,
      playerCount: 0,
      belowMinimum: false,
      withoutPlayers: false,
      overMaximum: false,
      freeSeatCount: 0,
      surplusPlayerCount: 0,
      cancellable: false,
      gameMasterSignedUpGameIds: ['brumes'],
    });
    expect(draw.assignments.find(({ participantId }) => participantId === 'p-g2')).toEqual({
      participantId: 'p-g2',
      gameId: null,
      movedByHand: false,
      signedUpGameIds: ['brumes'],
      playsWithoutSignUp: false,
    });
  });
});

describe('Relancer le tirage (TI-6)', () => {
  /** Élodie inscrite à « brumes » et à « épice », Lune à « épice ». Le tirage du créneau 1 est lancé. */
  function aLaunchedConvention(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, new FakeDrawAlgorithm(), RANDOM);
    return convention;
  }

  it('enregistre un nouveau tirage, que l’algorithme rend, et garde les inscriptions fermées', () => {
    const convention = aLaunchedConvention();

    convention.rerunDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    expect(assignmentsOf(convention, 's1')).toEqual(['p1 brumes', 'p2 epice']);
    expect(stateOf(convention, 's1')).toBe('drawing');
  });

  it('efface les déplacements à la main', () => {
    const moved = restoreWithDraws(aLaunchedConvention(), [
      new Draw('s1', false, [
        new Assignment('p1', 'epice', true),
        new Assignment('p2', null, true),
      ]),
    ]);

    moved.rerunDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    expect(moved.draws[0]!.assignments.some(({ movedByHand }) => movedByHand)).toBe(false);
  });

  it('relit les places du catalogue et les participants, avec la source de hasard', () => {
    const convention = aLaunchedConvention();
    const catalogue = ScenarioCatalogue.restore([
      { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 4, maxSeats: 6 },
      { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 2, maxSeats: 3 },
      { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
    ]);
    let received: { input: DrawInput; random: () => number } | null = null;
    const algorithm: DrawAlgorithm = {
      computeAssignments(input, random) {
        received = { input, random };
        return input.participants.map(({ id }) => ({ participantId: id, gameId: null }));
      },
    };

    convention.rerunDraw('s1', catalogue, algorithm, RANDOM);

    expect(received).toEqual({
      input: {
        games: [
          { id: 'brumes', minSeats: 4, maxSeats: 6 },
          { id: 'epice', minSeats: 2, maxSeats: 3 },
        ],
        participants: [
          { id: 'p1', gameIds: ['brumes', 'epice'] },
          { id: 'p2', gameIds: ['epice'] },
        ],
      },
      random: RANDOM,
    });
  });

  it('lève une erreur interne sur une sortie fautive, et garde le tirage d’avant', () => {
    const convention = aLaunchedConvention();
    const faulty = new FakeDrawAlgorithm(() => [{ participantId: 'p1', gameId: 'neons' }]);

    expect(() => convention.rerunDraw('s1', CATALOGUE, faulty, RANDOM)).toThrow(
      FaultyDrawOutputError,
    );
    expect(assignmentsOf(convention, 's1')).toEqual(['p1 -', 'p2 -']);
  });
});

describe('Rouvrir les inscriptions (TI-6)', () => {
  it('efface le tirage : les inscriptions du créneau sont rouvertes', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    convention.reopenSignUps('s1');

    expect(convention.draws).toEqual([]);
    expect(stateOf(convention, 's1')).toBe('sign-ups-open');
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    expect(convention.computeParticipantSituation('p2').signedUpGameIds).toEqual(['brumes']);
  });

  it('garde les tirages des autres créneaux', () => {
    const convention = restoreWithDraws(aConvention(), [
      new Draw('s1', true, []),
      new Draw('s2', false, []),
    ]);

    convention.reopenSignUps('s2');

    expect(convention.draws.map(({ timeSlotId }) => timeSlotId)).toEqual(['s1']);
  });

  it('garde les participants sans partie du créneau', () => {
    const base = aConvention();
    const convention = Convention.restore({
      id: base.id,
      name: base.name,
      date: base.date,
      timeSlots: [...base.timeSlots],
      tables: [...base.tables],
      gameMasters: [...base.gameMasters],
      participants: [...base.participants],
      signUps: [],
      participantsWithoutGame: [new ParticipantWithoutGame('p1', 's1')],
      draws: [new Draw('s1', false, [new Assignment('p1', null, false)])],
      games: [...base.games],
      version: base.version,
      presenceCode: base.presenceCode,
    });

    convention.reopenSignUps('s1');

    expect(
      convention
        .computeParticipantSituation('p1')
        .timeSlots.find(({ timeSlotId }) => timeSlotId === 's1')?.withoutGame,
    ).toBe(true);
  });
});

describe('Relancer et rouvrir : refus, dans l’ordre', () => {
  const gestures = {
    relancer: (convention: Convention, timeSlotId: string) =>
      convention.rerunDraw(timeSlotId, CATALOGUE, new FakeDrawAlgorithm(), RANDOM),
    rouvrir: (convention: Convention, timeSlotId: string) => convention.reopenSignUps(timeSlotId),
  };

  for (const [name, gesture] of Object.entries(gestures)) {
    describe(name, () => {
      it('refuse un créneau dont le tirage n’est pas lancé', () => {
        expect(refusalOf(() => gesture(aConvention(), 's1'))).toMatchObject({
          code: 'draw-not-launched',
          params: { rank: 1 },
        });
      });

      it('refuse un créneau dont le tirage est publié', () => {
        const convention = restoreWithDraws(aConvention(), [new Draw('s1', true, [])]);

        expect(refusalOf(() => gesture(convention, 's1'))).toMatchObject({
          code: 'draw-published',
          params: { rank: 1 },
        });
      });

      it('refuse un créneau introuvable', () => {
        expect(refusalOf(() => gesture(aConvention(), 'inconnu')).code).toBe('time-slot-not-found');
      });
    });
  }
});

describe('Annuler une partie (TI-6)', () => {
  /** Élodie et Lune placées à « épice », Zéphyr à « brumes ». Le tirage du créneau 1 est lancé. */
  function aLaunchedConvention(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.signUpForGame('p3', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    return convention;
  }

  it('fait passer ses joueurs dans les non placés, sans marque, et y fait entrer son MJ', () => {
    const convention = aLaunchedConvention();

    convention.cancelGame('brumes', CATALOGUE);

    expect(assignmentsOf(convention, 's1')).toEqual(['p3 -', 'p1 epice', 'p2 epice', 'p-g1 -']);
    expect(convention.draws[0]!.assignments.some(({ movedByHand }) => movedByHand)).toBe(false);
    expect(convention.draws[0]!.cancelledGameIds).toEqual(['brumes']);
  });

  it('annule une partie sans joueur', () => {
    const convention = aLaunchedConvention();
    convention.rerunDraw('s1', CATALOGUE, new FakeDrawAlgorithm(), RANDOM);

    convention.cancelGame('epice', CATALOGUE);

    expect(convention.draws[0]!.cancelledGameIds).toEqual(['epice']);
  });

  it('rend actives les inscriptions de son MJ, sur les deux créneaux d’une partie double, jusqu’au rétablissement (IN-4)', () => {
    const convention = aConvention();
    convention.unscheduleGame('epice');
    convention.signUpForGame('p-g2', 'brumes', CATALOGUE);
    convention.signUpForGame('p-g2', 'neons', CATALOGUE);
    convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    const signUpCounts = () =>
      convention
        .computeSignUpTracking(CATALOGUE)
        .flatMap(({ games }) => games)
        .filter(({ gameId }) => gameId !== 'epice')
        .map(({ gameId, signUpCount }) => `${gameId} ${signUpCount}`);
    expect(signUpCounts()).toEqual(['brumes 0', 'neons 0']);

    convention.cancelGame('epice', CATALOGUE);
    expect(signUpCounts()).toEqual(['brumes 1', 'neons 1']);

    convention.restoreGame('epice');
    expect(signUpCounts()).toEqual(['brumes 0', 'neons 0']);
    expect(assignmentsOf(convention, 's1')).toEqual([]);
  });

  it('ne montre rien de l’annulation au téléphone du MJ avant la publication (§5.7)', () => {
    const convention = aConvention();
    convention.unscheduleGame('epice');
    convention.signUpForGame('p-g2', 'brumes', CATALOGUE);
    convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    convention.cancelGame('epice', CATALOGUE);

    const situation = convention.computeParticipantSituation('p-g2');
    expect(situation.signedUpGameIds).toEqual([]);
    expect(situation.timeSlots[0]).toMatchObject({ ledGameId: 'epice', drawResult: null });
  });

  it('se garde à la relance, qui ne la donne pas à l’algorithme et y reprend son MJ', () => {
    const convention = aConvention();
    convention.unscheduleGame('epice');
    convention.signUpForGame('p-g2', 'brumes', CATALOGUE);
    convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.cancelGame('epice', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm();

    convention.rerunDraw('s1', CATALOGUE, algorithm, RANDOM);

    expect(algorithm.received).toEqual({
      games: [{ id: 'brumes', minSeats: 3, maxSeats: 5 }],
      // Élodie n'est inscrite qu'à la partie annulée : elle reste au tirage, sans partie.
      participants: [
        { id: 'p-g2', gameIds: ['brumes'] },
        { id: 'p1', gameIds: [] },
      ],
    });
    expect(convention.draws[0]!.cancelledGameIds).toEqual(['epice']);
  });
});

describe('Annuler une partie : refus, dans l’ordre', () => {
  /** Élodie, Lune et Zéphyr placés à « brumes », de 3 à 5 places. */
  function aFullConvention(): Convention {
    const convention = aConvention();
    for (const participantId of ['p1', 'p2', 'p3']) {
      convention.signUpForGame(participantId, 'brumes', CATALOGUE);
    }
    return convention;
  }

  it('refuse une partie dont le tirage n’est pas lancé', () => {
    expect(refusalOf(() => aConvention().cancelGame('epice', CATALOGUE))).toMatchObject({
      code: 'draw-not-launched',
      params: { rank: 1 },
    });
  });

  it('refuse une partie dont le tirage est publié', () => {
    const convention = restoreWithDraws(aConvention(), [new Draw('s1', true, [])]);

    expect(refusalOf(() => convention.cancelGame('epice', CATALOGUE))).toMatchObject({
      code: 'draw-published',
      params: { rank: 1 },
    });
  });

  it('refuse une partie déjà annulée', () => {
    const convention = restoreWithDraws(aConvention(), [
      new Draw('s1', false, [new Assignment('p-g2', null, false)], ['epice']),
    ]);

    expect(refusalOf(() => convention.cancelGame('epice', CATALOGUE)).code).toBe(
      'game-already-cancelled',
    );
  });

  it('refuse une partie qui a son minimum de joueurs', () => {
    const convention = aFullConvention();
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    expect(refusalOf(() => convention.cancelGame('brumes', CATALOGUE))).toMatchObject({
      code: 'game-not-below-minimum',
      params: { players: 3, min: 3 },
    });
  });

  it('relit le minimum dans le catalogue : la même partie s’annule si le minimum monte (PR-4)', () => {
    const convention = aFullConvention();
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    const catalogue = ScenarioCatalogue.restore([
      { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 4, maxSeats: 5 },
      { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 2, maxSeats: 4 },
      { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
    ]);

    convention.cancelGame('brumes', catalogue);

    expect(convention.draws[0]!.cancelledGameIds).toEqual(['brumes']);
  });

  it('refuse une partie introuvable', () => {
    expect(refusalOf(() => aConvention().cancelGame('inconnue', CATALOGUE)).code).toBe(
      'game-not-found',
    );
  });
});

describe('Rétablir une partie (TI-6)', () => {
  it('la fait revenir sans joueur, et fait sortir son MJ du tirage, même placé ailleurs', () => {
    const convention = restoreWithDraws(aConvention(), [
      new Draw(
        's1',
        false,
        [new Assignment('p1', null, false), new Assignment('p-g1', 'epice', true)],
        ['brumes'],
      ),
    ]);

    convention.restoreGame('brumes');

    expect(assignmentsOf(convention, 's1')).toEqual(['p1 -']);
    expect(convention.draws[0]!.cancelledGameIds).toEqual([]);
  });

  it('refuse une partie qui n’est pas annulée', () => {
    const convention = restoreWithDraws(aConvention(), [new Draw('s1', false, [])]);

    expect(refusalOf(() => convention.restoreGame('brumes')).code).toBe('game-not-cancelled');
  });

  it('refuse une partie dont le tirage n’est pas lancé, puis publié', () => {
    expect(refusalOf(() => aConvention().restoreGame('brumes')).code).toBe('draw-not-launched');
    const published = restoreWithDraws(aConvention(), [new Draw('s1', true, [], ['brumes'])]);
    expect(refusalOf(() => published.restoreGame('brumes')).code).toBe('draw-published');
  });
});
