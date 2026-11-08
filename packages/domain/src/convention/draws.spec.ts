import { describe, expect, it } from 'vitest';
import type { Notification } from '../notification.js';
import { Refusal } from '../refusal.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { Seats } from '../scenario/seats.js';
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
    .computeParticipantSituation('p1', NOW)
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

    expect(convention.computeParticipantSituation('p1', NOW).signedUpGameIds).toEqual([
      'epice',
      'neons',
    ]);
  });

  it('garde active son inscription à la partie double elle-même', () => {
    const convention = aConventionWithFirstDraw(true);

    expect(convention.computeParticipantSituation('p1', NOW).signedUpGameIds).toEqual(['epice']);
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
          withoutGame: false,
          gameMasterOfCancelledGame: false,
        },
        {
          participantId: 'p2',
          gameId: null,
          movedByHand: false,
          signedUpGameIds: ['epice'],
          playsWithoutSignUp: false,
          withoutGame: false,
          gameMasterOfCancelledGame: false,
        },
        {
          participantId: 'p3',
          gameId: 'brumes',
          movedByHand: false,
          signedUpGameIds: ['brumes'],
          playsWithoutSignUp: false,
          withoutGame: false,
          gameMasterOfCancelledGame: false,
        },
      ],
      signals: [
        {
          code: 'participants-unassigned',
          level: 'danger',
          params: { unassignedCount: 1, freeSeatCount: 7 },
        },
        { code: 'games-below-minimum', level: 'warning', params: { gameCount: 2 } },
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
      withoutGame: false,
      gameMasterOfCancelledGame: false,
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
      withoutGame: false,
      gameMasterOfCancelledGame: true,
    });
  });
});

describe('Signaux du tirage (TI-5)', () => {
  const signalsOf = (convention: Convention, catalogue: ScenarioCatalogue) =>
    convention.computeSignUpTracking(catalogue).find((slot) => slot.timeSlotId === 's1')!.draw!
      .signals;

  /** « brumes » de 1 place, « épice » de 2 à 4, « forge » de 3 à 5. */
  const catalogue = ScenarioCatalogue.restore([
    { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 1, maxSeats: 1 },
    { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 2, maxSeats: 4 },
    { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
    { id: 'd', gameMasterId: 'g3', duration: 1, minSeats: 3, maxSeats: 5 },
  ]);

  /**
   * Au créneau 1, en plus : « forge » (t3, MJ Mira), et le participant Maël (p4). Élodie et Lune
   * jouent à « brumes », Zéphyr à « forge », Maël n'est pas placé, « épice » n'a aucun joueur.
   */
  function aDrawWithEveryShortfall(published: boolean): Convention {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.addGameMaster('g3', 'p-g3', 'Mira');
    convention.declareGameMasterAvailability('g3', 's1');
    convention.scheduleScenario('forge', aScenario('d', 'g3'), 's1', 't3');
    convention.identifyByNickname('p4', 'K7M2', 'Maël', null, NOW);
    convention.launchDraw('s1', catalogue, FIRST_GAME, RANDOM);
    return restoreWithDraws(convention, [
      new Draw('s1', published, [
        new Assignment('p1', 'brumes', true),
        new Assignment('p2', 'brumes', true),
        new Assignment('p3', 'forge', true),
        new Assignment('p4', null, true),
      ]),
    ]);
  }

  it('donne chaque signal avec ses paramètres, les rouges d’abord', () => {
    expect(signalsOf(aDrawWithEveryShortfall(false), catalogue)).toEqual([
      {
        code: 'participants-unassigned',
        level: 'danger',
        params: { unassignedCount: 1, freeSeatCount: 8 },
      },
      // « épice » n'a aucun joueur : elle n'est pas « sous son minimum ».
      { code: 'games-without-players', level: 'danger', params: { gameCount: 1 } },
      { code: 'games-below-minimum', level: 'warning', params: { gameCount: 1 } },
      {
        code: 'games-over-maximum',
        level: 'warning',
        params: { games: [{ gameId: 'brumes', playerCount: 2, maxSeats: 1 }] },
      },
    ]);
  });

  it('n’en donne aucun sur un tirage publié', () => {
    expect(signalsOf(aDrawWithEveryShortfall(true), catalogue)).toEqual([]);
  });

  it('ne compte une partie annulée dans aucun', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    convention.cancelGame('epice', CATALOGUE);

    // Kaïros, le MJ d'« épice », entre au tirage, non placé.
    expect(signalsOf(convention, CATALOGUE)).toEqual([
      {
        code: 'participants-unassigned',
        level: 'danger',
        params: { unassignedCount: 1, freeSeatCount: 4 },
      },
      { code: 'games-below-minimum', level: 'warning', params: { gameCount: 1 } },
    ]);
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
    expect(convention.computeParticipantSituation('p2', NOW).signedUpGameIds).toEqual(['brumes']);
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
        .computeParticipantSituation('p1', NOW)
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

    const situation = convention.computeParticipantSituation('p-g2', NOW);
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

describe('Déplacer un participant (TI-6)', () => {
  /** Élodie et Lune placées à « épice », Zéphyr à « brumes ». Le tirage du créneau 1 est lancé. */
  function aLaunchedConvention(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.signUpForGame('p3', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    return convention;
  }

  it('le place sur une partie où il n’est pas inscrit, marqué « déplacé à la main »', () => {
    const convention = aLaunchedConvention();

    convention.moveParticipant('s1', 'p1', 'brumes');

    expect(assignmentsOf(convention, 's1')).toEqual(['p3 brumes', 'p1 brumes', 'p2 epice']);
    const assignment = convention
      .computeSignUpTracking(CATALOGUE)
      .find((slot) => slot.timeSlotId === 's1')!
      .draw!.assignments.find(({ participantId }) => participantId === 'p1');
    expect(assignment).toMatchObject({ movedByHand: true, playsWithoutSignUp: true });
  });

  it('le place au-delà du maximum de la partie', () => {
    const convention = aLaunchedConvention();
    const catalogue = ScenarioCatalogue.restore([
      { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 1, maxSeats: 1 },
      { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 2, maxSeats: 4 },
      { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
    ]);

    convention.moveParticipant('s1', 'p2', 'brumes');

    const brumes = convention
      .computeSignUpTracking(catalogue)
      .find((slot) => slot.timeSlotId === 's1')!
      .draw!.games.find(({ gameId }) => gameId === 'brumes');
    expect(brumes).toMatchObject({ playerCount: 2, overMaximum: true, surplusPlayerCount: 1 });
  });

  it('le retire de sa table : il passe dans les non placés, marqué', () => {
    const convention = aLaunchedConvention();

    convention.moveParticipant('s1', 'p3', null);

    expect(assignmentsOf(convention, 's1')).toEqual(['p3 -', 'p1 epice', 'p2 epice']);
    expect(convention.draws[0]!.assignments[0]!.movedByHand).toBe(true);
  });

  it('ne change rien vers sa partie actuelle : il n’est pas marqué', () => {
    const convention = aLaunchedConvention();

    convention.moveParticipant('s1', 'p1', 'epice');

    expect(assignmentsOf(convention, 's1')).toEqual(['p3 brumes', 'p1 epice', 'p2 epice']);
    expect(convention.draws[0]!.assignments.some(({ movedByHand }) => movedByHand)).toBe(false);
  });
});

describe('Déplacer un participant : refus, dans l’ordre', () => {
  function aLaunchedConvention(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    return convention;
  }

  it('refuse un créneau dont le tirage n’est pas lancé, puis publié', () => {
    expect(refusalOf(() => aConvention().moveParticipant('s1', 'p1', 'brumes'))).toMatchObject({
      code: 'draw-not-launched',
      params: { rank: 1 },
    });
    const published = restoreWithDraws(aConvention(), [
      new Draw('s1', true, [new Assignment('p1', null, false)]),
    ]);
    expect(refusalOf(() => published.moveParticipant('s1', 'p1', 'brumes')).code).toBe(
      'draw-published',
    );
  });

  it('refuse un participant hors du tirage, en le nommant', () => {
    const convention = aLaunchedConvention();

    expect(refusalOf(() => convention.moveParticipant('s1', 'p2', 'brumes'))).toMatchObject({
      code: 'participant-not-in-draw',
      params: { nickname: 'Lune', rank: 1 },
    });
  });

  it('refuse une partie qui ne commence pas sur le créneau, seconde moitié d’une partie double comprise', () => {
    const convention = aLaunchedConvention();

    expect(refusalOf(() => convention.moveParticipant('s1', 'p1', 'neons'))).toMatchObject({
      code: 'game-not-on-time-slot',
      params: { rank: 1 },
    });
    const second = restoreWithDraws(aConvention(), [
      new Draw('s1', true, []),
      new Draw('s2', false, [new Assignment('p1', null, false)]),
    ]);
    expect(refusalOf(() => second.moveParticipant('s2', 'p1', 'epice')).code).toBe(
      'game-not-on-time-slot',
    );
  });

  it('refuse une partie annulée', () => {
    const convention = aLaunchedConvention();
    convention.cancelGame('epice', CATALOGUE);

    expect(refusalOf(() => convention.moveParticipant('s1', 'p1', 'epice')).code).toBe(
      'game-cancelled',
    );
  });

  it('refuse une partie introuvable', () => {
    const convention = aLaunchedConvention();

    expect(refusalOf(() => convention.moveParticipant('s1', 'p1', 'inconnue')).code).toBe(
      'game-not-found',
    );
  });
});

describe('Publier le tirage (TI-7)', () => {
  /**
   * Élodie et Lune inscrites à « brumes », Zéphyr à « épice ». Au tirage du créneau 1, Élodie joue
   * à « brumes », Zéphyr à « épice », Lune n'est pas placée.
   */
  function aLaunchedConvention(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    convention.signUpForGame('p3', 'epice', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm(() => [
      { participantId: 'p1', gameId: 'brumes' },
      { participantId: 'p2', gameId: null },
      { participantId: 'p3', gameId: 'epice' },
    ]);
    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);
    return convention;
  }

  it('fige le tirage : le créneau est publié, ses affectations restent', () => {
    const convention = aLaunchedConvention();

    convention.publishDraw('s1', CATALOGUE);

    expect(stateOf(convention, 's1')).toBe('published');
    expect(assignmentsOf(convention, 's1')).toEqual(['p1 brumes', 'p2 -', 'p3 epice']);
    expect(refusalOf(() => convention.moveParticipant('s1', 'p2', 'brumes')).code).toBe(
      'draw-published',
    );
  });

  it('prévient les joueurs de chaque partie, les non placés, puis les MJ', () => {
    const convention = aLaunchedConvention();

    const notifications = convention.publishDraw('s1', CATALOGUE);

    expect(
      notifications.map(({ code, params, recipients }) => ({ code, params, recipients })),
    ).toEqual([
      {
        code: 'draw-assigned',
        params: {
          gameId: 'brumes',
          scenarioId: 'a',
          ranks: [1],
          tableName: 'Table 1',
          gameMasterNickname: 'Brann',
        },
        recipients: { kind: 'participants', participantIds: ['p1'] },
      },
      {
        code: 'draw-assigned',
        params: {
          gameId: 'epice',
          scenarioId: 'b',
          ranks: [1, 2],
          tableName: 'Table 2',
          gameMasterNickname: 'Kaïros',
        },
        recipients: { kind: 'participants', participantIds: ['p3'] },
      },
      {
        code: 'draw-unassigned',
        params: { rank: 1, tablesWithSeats: ['Table 1', 'Table 2'], withoutGame: false },
        recipients: { kind: 'participants', participantIds: ['p2'] },
      },
      {
        code: 'draw-leading',
        params: { scenarioId: 'a', ranks: [1], tableName: 'Table 1', playerCount: 1 },
        recipients: { kind: 'participants', participantIds: ['p-g1'] },
      },
      {
        code: 'draw-leading',
        params: { scenarioId: 'b', ranks: [1, 2], tableName: 'Table 2', playerCount: 1 },
        recipients: { kind: 'participants', participantIds: ['p-g2'] },
      },
    ]);
  });

  it('donne à chaque notification la fin du créneau pour échéance, le second d’une partie double (NO-3)', () => {
    const convention = aLaunchedConvention();
    convention.changeDate('2027-03-14');

    const deadlines = convention
      .publishDraw('s1', CATALOGUE)
      .map(({ code, deadline }) => `${code} ${deadline?.date} ${deadline?.time.toString()}`);

    expect(deadlines).toEqual([
      'draw-assigned 2027-03-14 11:30',
      'draw-assigned 2027-03-14 16:30',
      'draw-unassigned 2027-03-14 11:30',
      'draw-leading 2027-03-14 11:30',
      'draw-leading 2027-03-14 16:30',
    ]);
  });

  it('n’annonce pas de place libre à une table pleine', () => {
    const convention = aConvention();
    for (const participantId of ['p1', 'p2', 'p3']) {
      convention.signUpForGame(participantId, 'brumes', CATALOGUE);
    }
    const full = ScenarioCatalogue.restore([
      { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 1, maxSeats: 2 },
      { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 0, maxSeats: 1 },
      { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
    ]);
    convention.identifyByNickname('p4', 'K7M2', 'Ysé', null, NOW);
    convention.signUpForGame('p4', 'epice', full);
    const algorithm = new FakeDrawAlgorithm(() => [
      { participantId: 'p1', gameId: 'brumes' },
      { participantId: 'p2', gameId: 'brumes' },
      { participantId: 'p3', gameId: null },
      { participantId: 'p4', gameId: 'epice' },
    ]);
    convention.launchDraw('s1', full, algorithm, RANDOM);

    const unassigned = convention
      .publishDraw('s1', full)
      .find(({ code }) => code === 'draw-unassigned');

    expect(unassigned?.params).toEqual({ rank: 1, tablesWithSeats: [], withoutGame: false });
  });

  it('n’annonce pas les places de la partie double commencée au créneau d’avant', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'neons', CATALOGUE);
    convention.signUpForGame('p3', 'neons', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.cancelGame('brumes', CATALOGUE);
    convention.publishDraw('s1', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm(() => [
      { participantId: 'p2', gameId: 'neons' },
      { participantId: 'p3', gameId: null },
    ]);
    convention.launchDraw('s2', CATALOGUE, algorithm, RANDOM);

    const unassigned = convention
      .publishDraw('s2', CATALOGUE)
      .find(({ code }) => code === 'draw-unassigned');

    expect(unassigned?.params).toEqual({
      rank: 2,
      tablesWithSeats: ['Table 1'],
      withoutGame: false,
    });
  });

  it('publie un créneau sans partie, sans notification', () => {
    const convention = restoreWithDraws(aConvention(), [
      new Draw('s1', true, []),
      new Draw('s2', true, []),
    ]);
    convention.launchDraw('s3', CATALOGUE, FIRST_GAME, RANDOM);

    expect(convention.publishDraw('s3', CATALOGUE)).toEqual([]);
    expect(stateOf(convention, 's3')).toBe('published');
  });

  it('permet ensuite de lancer le créneau suivant', () => {
    const convention = aLaunchedConvention();
    convention.publishDraw('s1', CATALOGUE);

    convention.launchDraw('s2', CATALOGUE, FIRST_GAME, RANDOM);

    expect(stateOf(convention, 's2')).toBe('drawing');
  });
});

describe('Publier un tirage qui a des parties annulées (TI-7)', () => {
  /**
   * Élodie inscrite à « épice », partie double de 2 à 4 places ; Lune et Zéphyr à « brumes ». Au
   * tirage du créneau 1, chacun est sur sa partie, puis « épice » est annulée : Élodie et Kaïros, son
   * MJ, sont non placés.
   */
  function aConventionWithCancelledGame(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    convention.signUpForGame('p3', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.cancelGame('epice', CATALOGUE);
    return convention;
  }

  it('déprogramme la partie annulée : son scénario retourne dans la réserve', () => {
    const convention = aConventionWithCancelledGame();

    convention.publishDraw('s1', CATALOGUE);

    expect(convention.games.map(({ id }) => id)).toEqual(['brumes', 'neons']);
    expect(convention.computeReserve(CATALOGUE).map(({ scenarioId }) => scenarioId)).toContain('b');
  });

  it('libère sa table et son MJ, sur les deux créneaux d’une partie double', () => {
    const convention = aConventionWithCancelledGame();

    convention.publishDraw('s1', CATALOGUE);

    expect(() =>
      convention.scheduleScenario('dune', aScenario('d', 'g2'), 's2', 't2'),
    ).not.toThrow();
  });

  it('garde le tirage, sans partie annulée, et ne crée aucun participant sans partie', () => {
    const convention = aConventionWithCancelledGame();

    convention.publishDraw('s1', CATALOGUE);

    expect(assignmentsOf(convention, 's1')).toEqual(['p2 brumes', 'p3 brumes', 'p1 -', 'p-g2 -']);
    expect(convention.draws[0]!.cancelledGameIds).toEqual([]);
    expect(convention.participantsWithoutGame).toEqual([]);
    expect(convention.signUps.some(({ gameId }) => gameId === 'epice')).toBe(false);
    expect(convention.computeParticipantSituation('p1', NOW).timeSlots[0]!.withoutGame).toBe(false);
  });

  it('prévient le MJ resté non placé de l’annulation seulement, sans les notifications de IN-6', () => {
    const convention = aConventionWithCancelledGame();
    convention.changeDate('2027-03-14');

    const notifications = convention.publishDraw('s1', CATALOGUE);

    expect(
      notifications.map(({ code, params, recipients, deadline }) => ({
        code,
        params,
        recipients: recipients.participantIds,
        deadline: deadline?.time.toString(),
      })),
    ).toEqual([
      {
        code: 'game-cancelled',
        params: { scenarioId: 'b', ranks: [1, 2], tablesWithSeats: ['Table 1'] },
        recipients: ['p-g2'],
        deadline: '16:30',
      },
      {
        code: 'draw-assigned',
        params: {
          gameId: 'brumes',
          scenarioId: 'a',
          ranks: [1],
          tableName: 'Table 1',
          gameMasterNickname: 'Brann',
        },
        recipients: ['p2', 'p3'],
        deadline: '11:30',
      },
      {
        code: 'draw-unassigned',
        params: { rank: 1, tablesWithSeats: ['Table 1'], withoutGame: false },
        recipients: ['p1'],
        deadline: '11:30',
      },
      {
        code: 'draw-leading',
        params: { scenarioId: 'a', ranks: [1], tableName: 'Table 1', playerCount: 2 },
        recipients: ['p-g1'],
        deadline: '11:30',
      },
    ]);
  });

  it('prévient le MJ placé de l’annulation, puis de sa table (NO-1)', () => {
    const convention = aConventionWithCancelledGame();
    convention.moveParticipant('s1', 'p-g2', 'brumes');

    const notifications = convention.publishDraw('s1', CATALOGUE);

    expect(
      notifications
        .filter(({ recipients }) => recipients.participantIds.includes('p-g2'))
        .map(({ code }) => code),
    ).toEqual(['game-cancelled', 'draw-assigned']);
  });

  it('donne au MJ libéré son sort de joueur sur le téléphone', () => {
    const unassigned = aConventionWithCancelledGame();
    const assigned = aConventionWithCancelledGame();
    assigned.moveParticipant('s1', 'p-g2', 'brumes');

    unassigned.publishDraw('s1', CATALOGUE);
    assigned.publishDraw('s1', CATALOGUE);

    expect(unassigned.computeParticipantSituation('p-g2', NOW).timeSlots[0]).toMatchObject({
      ledGameId: null,
      drawResult: { kind: 'unassigned' },
    });
    expect(assigned.computeParticipantSituation('p-g2', NOW).timeSlots[0]).toMatchObject({
      ledGameId: null,
      drawResult: { kind: 'assigned', gameId: 'brumes' },
    });
  });
});

describe('Publier le tirage : refus, dans l’ordre', () => {
  it('refuse un créneau dont le tirage n’est pas lancé', () => {
    const refusal = refusalOf(() => aConvention().publishDraw('s1', CATALOGUE));

    expect(refusal.code).toBe('draw-not-launched');
    expect(refusal.params).toEqual({ rank: 1 });
  });

  it('refuse un créneau dont le tirage est publié', () => {
    const convention = restoreWithDraws(aConvention(), [new Draw('s1', true, [])]);

    expect(refusalOf(() => convention.publishDraw('s1', CATALOGUE)).code).toBe('draw-published');
  });

  it('refuse un tirage dont une partie non annulée n’a aucun joueur', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    const refusal = refusalOf(() => convention.publishDraw('s1', CATALOGUE));

    expect(refusal.code).toBe('games-without-players');
    expect(refusal.params).toEqual({ rank: 1, games: 1 });
    expect(stateOf(convention, 's1')).toBe('drawing');
  });

  it('publie un tirage dont la partie sans joueur est annulée', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.cancelGame('epice', CATALOGUE);

    convention.publishDraw('s1', CATALOGUE);

    expect(stateOf(convention, 's1')).toBe('published');
  });

  it('refuse un créneau introuvable', () => {
    expect(refusalOf(() => aConvention().publishDraw('inconnu', CATALOGUE)).code).toBe(
      'time-slot-not-found',
    );
  });
});

describe('Créneau terminé : tirage publié et heure de fin passée', () => {
  /**
   * La convention du 14 mars 2027, le tirage du créneau 1 (9 h – 11 h 30) lancé : Élodie à
   * « brumes », Lune à « épice ».
   */
  function aLaunchedConventionOnMarch14(): Convention {
    const convention = aConvention();
    convention.changeDate('2027-03-14');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    return convention;
  }

  const moment = (date: string, time: string): LocalMoment => ({ date, time: at(time) });
  const stateAt = (convention: Convention, timeSlotId: string, now: LocalMoment) =>
    convention
      .computeParticipantSituation('p1', now)
      .timeSlots.find((slot) => slot.timeSlotId === timeSlotId)?.state;

  it.each([
    ['une minute avant la fin', '2027-03-14', '11:29', 'published'],
    ['à la fin', '2027-03-14', '11:30', 'ended'],
    ['le lendemain', '2027-03-15', '08:00', 'ended'],
  ])('termine un créneau publié dès son heure de fin : %s', (_, date, time, state) => {
    const convention = aLaunchedConventionOnMarch14();
    convention.publishDraw('s1', CATALOGUE);

    expect(convention.computeTimeSlotStateAt('s1', moment(date, time))).toBe(state);
    expect(stateAt(convention, 's1', moment(date, time))).toBe(state);
  });

  it('ne termine pas un créneau dont le tirage n’est pas publié, même son heure passée', () => {
    const convention = aLaunchedConventionOnMarch14();
    const nextDay = moment('2027-03-15', '08:00');

    expect(convention.computeTimeSlotStateAt('s1', nextDay)).toBe('drawing');
    expect(convention.computeTimeSlotStateAt('s2', nextDay)).toBe('sign-ups-open');
  });

  it('ne termine aucun créneau sans date', () => {
    const convention = aLaunchedConventionOnMarch14();
    convention.publishDraw('s1', CATALOGUE);
    convention.changeDate(null);

    expect(convention.computeTimeSlotStateAt('s1', moment('2030-01-01', '00:00'))).toBe(
      'published',
    );
  });
});

describe('Résultat du tirage sur le téléphone (§5.3, §5.7)', () => {
  /**
   * Lune et Élodie jouent à « brumes », Zéphyr à « épice » ; Ysé, inscrite à « brumes », n'est pas
   * placée.
   */
  function aLaunchedConvention(): Convention {
    const convention = aConvention();
    convention.identifyByNickname('p4', 'K7M2', 'Ysé', null, NOW);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p4', 'brumes', CATALOGUE);
    convention.signUpForGame('p3', 'epice', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm(() => [
      { participantId: 'p2', gameId: 'brumes' },
      { participantId: 'p1', gameId: 'brumes' },
      { participantId: 'p4', gameId: null },
      { participantId: 'p3', gameId: 'epice' },
    ]);
    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);
    return convention;
  }

  const resultOf = (convention: Convention, participantId: string, timeSlotId: string) =>
    convention
      .computeParticipantSituation(participantId, NOW)
      .timeSlots.find((slot) => slot.timeSlotId === timeSlotId)?.drawResult;

  it('reste caché tant que le tirage est provisoire', () => {
    const convention = aLaunchedConvention();

    expect(resultOf(convention, 'p1', 's1')).toBeNull();
    expect(resultOf(convention, 'p4', 's1')).toBeNull();
    expect(resultOf(convention, 'p-g1', 's1')).toBeNull();
  });

  it('donne au participant placé sa partie, au non placé « pas de place »', () => {
    const convention = aLaunchedConvention();
    convention.publishDraw('s1', CATALOGUE);

    expect(resultOf(convention, 'p1', 's1')).toEqual({ kind: 'assigned', gameId: 'brumes' });
    expect(resultOf(convention, 'p4', 's1')).toEqual({ kind: 'unassigned' });
  });

  it('donne au MJ ses joueurs, dans l’ordre naturel de leur pseudo, sur le créneau où commence sa partie', () => {
    const convention = aLaunchedConvention();
    convention.publishDraw('s1', CATALOGUE);

    expect(resultOf(convention, 'p-g1', 's1')).toEqual({
      kind: 'leading',
      players: ['Élodie', 'Lune'],
    });
    expect(resultOf(convention, 'p-g2', 's1')).toEqual({ kind: 'leading', players: ['Zéphyr'] });
    expect(resultOf(convention, 'p-g2', 's2')).toBeNull();
  });

  it('ne donne rien à qui n’est pas du tirage', () => {
    const convention = aLaunchedConvention();
    convention.identifyByNickname('p5', 'K7M2', 'Anouk', null, NOW);
    convention.publishDraw('s1', CATALOGUE);

    expect(resultOf(convention, 'p5', 's1')).toBeNull();
  });
});

describe('Fiche d’un pseudo : son résultat sur chaque créneau (ID-5)', () => {
  /**
   * Lune et Élodie jouent à « brumes », Zéphyr à « épice », la partie double ; Ysé, inscrite à
   * « brumes », n'est pas placée. Anouk n'est pas du tirage.
   */
  function aLaunchedConvention(): Convention {
    const convention = aConvention();
    convention.identifyByNickname('p4', 'K7M2', 'Ysé', null, NOW);
    convention.identifyByNickname('p5', 'K7M2', 'Anouk', null, NOW);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p4', 'brumes', CATALOGUE);
    convention.signUpForGame('p3', 'epice', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm(() => [
      { participantId: 'p2', gameId: 'brumes' },
      { participantId: 'p1', gameId: 'brumes' },
      { participantId: 'p4', gameId: null },
      { participantId: 'p3', gameId: 'epice' },
    ]);
    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);
    return convention;
  }

  const findResultOfTimeSlot = (
    convention: Convention,
    participantId: string,
    timeSlotId: string,
  ) =>
    convention
      .computeParticipantResults(participantId, NOW, CATALOGUE)
      .find((slot) => slot.timeSlotId === timeSlotId);

  it('compte ses inscriptions sur un créneau ouvert, une partie double sur son premier créneau', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);

    expect(findResultOfTimeSlot(convention, 'p1', 's1')).toEqual({
      timeSlotId: 's1',
      state: 'sign-ups-open',
      result: { kind: 'signed-up', signUpCount: 2 },
    });
    expect(findResultOfTimeSlot(convention, 'p1', 's2')?.result).toEqual({
      kind: 'signed-up',
      signUpCount: 0,
    });
  });

  it('donne au participant placé sa table et le MJ de sa partie, dès le tirage provisoire', () => {
    const convention = aLaunchedConvention();

    expect(findResultOfTimeSlot(convention, 'p1', 's1')).toEqual({
      timeSlotId: 's1',
      state: 'drawing',
      result: {
        kind: 'assigned',
        gameId: 'brumes',
        tableName: 'Table 1',
        gameMasterNickname: 'Brann',
      },
    });
  });

  it('donne au non placé les tables où il reste de la place, et combien, dans l’ordre naturel', () => {
    const convention = aLaunchedConvention();

    expect(findResultOfTimeSlot(convention, 'p4', 's1')?.result).toEqual({
      kind: 'unassigned',
      tablesWithSeats: [
        { tableName: 'Table 1', freeSeatCount: 3 },
        { tableName: 'Table 2', freeSeatCount: 3 },
      ],
    });
  });

  it('se lit de même une fois le tirage publié', () => {
    const convention = aLaunchedConvention();
    convention.publishDraw('s1', CATALOGUE);

    expect(findResultOfTimeSlot(convention, 'p1', 's1')).toMatchObject({
      state: 'published',
      result: { kind: 'assigned', gameId: 'brumes' },
    });
    expect(findResultOfTimeSlot(convention, 'p4', 's1')?.result).toMatchObject({
      kind: 'unassigned',
    });
  });

  it('place le joueur d’une partie double sur ses deux créneaux (TI-3)', () => {
    const convention = aLaunchedConvention();

    expect(findResultOfTimeSlot(convention, 'p3', 's2')).toEqual({
      timeSlotId: 's2',
      state: 'sign-ups-open',
      result: {
        kind: 'assigned',
        gameId: 'epice',
        tableName: 'Table 2',
        gameMasterNickname: 'Kaïros',
      },
    });
  });

  it('donne au MJ la partie qu’il mène, sur chacun de ses créneaux', () => {
    const convention = aLaunchedConvention();

    expect(findResultOfTimeSlot(convention, 'p-g1', 's1')?.result).toEqual({
      kind: 'leading',
      gameId: 'brumes',
      tableName: 'Table 1',
    });
    expect(findResultOfTimeSlot(convention, 'p-g2', 's2')?.result).toEqual({
      kind: 'leading',
      gameId: 'epice',
      tableName: 'Table 2',
    });
  });

  it('dit « pas dans le tirage » sur un créneau tiré où il n’est pas', () => {
    expect(findResultOfTimeSlot(aLaunchedConvention(), 'p5', 's1')?.result).toEqual({
      kind: 'not-in-draw',
    });
  });
});

describe('Inscription active après la publication d’une partie double (TI-3, IN-4)', () => {
  /**
   * Élodie et Lune inscrites à « épice », partie double des créneaux 1 et 2, et à « néons », au
   * créneau 2. Au tirage du créneau 1, Élodie est placée à « épice », Lune ne l'est pas. Zéphyr
   * joue à « brumes ».
   */
  function aConventionWithFirstDraw(): Convention {
    const convention = aConvention();
    for (const participantId of ['p1', 'p2']) {
      convention.signUpForGame(participantId, 'epice', CATALOGUE);
      convention.signUpForGame(participantId, 'neons', CATALOGUE);
    }
    convention.signUpForGame('p3', 'brumes', CATALOGUE);
    const algorithm = new FakeDrawAlgorithm(() => [
      { participantId: 'p1', gameId: 'epice' },
      { participantId: 'p2', gameId: null },
      { participantId: 'p3', gameId: 'brumes' },
    ]);
    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);
    return convention;
  }

  const trackingOf = (convention: Convention, timeSlotId: string) =>
    convention.computeSignUpTracking(CATALOGUE).find((slot) => slot.timeSlotId === timeSlotId)!;

  it('compte, avant la publication, l’inscription du joueur au créneau suivant', () => {
    const tracking = trackingOf(aConventionWithFirstDraw(), 's2');

    expect(tracking.demand).toBe(2);
    expect(tracking.games[0]).toMatchObject({ gameId: 'neons', signUpCount: 2 });
  });

  it('ne la compte plus après : ni dans la demande, ni dans les inscrits, ni dans les participants', () => {
    const convention = aConventionWithFirstDraw();
    convention.publishDraw('s1', CATALOGUE);

    const tracking = trackingOf(convention, 's2');

    expect(tracking.demand).toBe(1);
    expect(tracking.games[0]).toMatchObject({ gameId: 'neons', signUpCount: 1 });
    expect(tracking.participants.map(({ participantId }) => participantId)).toEqual(['p2']);
    expect(
      convention.signUps.map(({ participantId, gameId }) => `${participantId} ${gameId}`),
    ).toContain('p1 neons');
  });

  it('garde active celle du joueur non placé', () => {
    const convention = aConventionWithFirstDraw();
    convention.publishDraw('s1', CATALOGUE);

    expect(convention.computeParticipantSituation('p2', NOW).signedUpGameIds).toEqual([
      'epice',
      'neons',
    ]);
  });

  it('ignore l’état sans partie du joueur sur le second créneau, après la publication seulement', () => {
    const base = aConvention();
    base.signUpForGame('p1', 'epice', CATALOGUE);
    base.signUpForGame('p3', 'brumes', CATALOGUE);
    const convention = restoreWithDraws(base, [
      new Draw('s1', false, [
        new Assignment('p1', 'epice', false),
        new Assignment('p3', 'brumes', false),
      ]),
    ]);
    const withoutGame = Convention.restore({
      ...stateOfConvention(convention),
      participantsWithoutGame: [new ParticipantWithoutGame('p1', 's2')],
    });
    const isWithoutGame = (candidate: Convention) =>
      candidate.computeParticipantSituation('p1', NOW).timeSlots[1]!.withoutGame;

    expect(isWithoutGame(withoutGame)).toBe(true);
    withoutGame.publishDraw('s1', CATALOGUE);
    expect(isWithoutGame(withoutGame)).toBe(false);
    expect(trackingOf(withoutGame, 's2').demand).toBe(0);
  });
});

/** L'état de la convention, pour la restaurer autrement. */
function stateOfConvention(convention: Convention) {
  return {
    id: convention.id,
    name: convention.name,
    date: convention.date,
    timeSlots: [...convention.timeSlots],
    tables: [...convention.tables],
    gameMasters: [...convention.gameMasters],
    participants: [...convention.participants],
    signUps: [...convention.signUps],
    participantsWithoutGame: [...convention.participantsWithoutGame],
    draws: [...convention.draws],
    games: [...convention.games],
    version: convention.version,
    presenceCode: convention.presenceCode,
  };
}

describe('Gestes de programmation sur un créneau en tirage (TI-6, IN-6)', () => {
  /** Les scénarios du catalogue, et d (MJ Ysolde) et e (MJ Orso), de 3 à 5 places. */
  const PROGRAMMING_CATALOGUE = ScenarioCatalogue.restore([
    ...CATALOGUE.listEntries(),
    { id: 'd', gameMasterId: 'g3', duration: 1, minSeats: 3, maxSeats: 5 },
    { id: 'e', gameMasterId: 'g4', duration: 1, minSeats: 3, maxSeats: 5 },
  ]);

  /**
   * Celle d'`aConvention()`, avec les tables t3 et t4, et les MJ Ysolde (g3) et Orso (g4),
   * disponibles sur les trois créneaux, comme Brann pour le créneau 3. « orage » (d, MJ Ysolde) est
   * au créneau 1, table 3. Élodie et Lune sont inscrites à « épice », Zéphyr à « brumes ». Le tirage
   * du créneau 1 est lancé, chacun sur sa partie.
   */
  function aDrawingConvention(): Convention {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.addTable('t4', 'Table 4');
    convention.addGameMaster('g3', 'p-g3', 'Ysolde');
    convention.addGameMaster('g4', 'p-g4', 'Orso');
    for (const slot of ['s1', 's2', 's3']) {
      convention.declareGameMasterAvailability('g3', slot);
      convention.declareGameMasterAvailability('g4', slot);
    }
    convention.declareGameMasterAvailability('g1', 's3');
    convention.scheduleScenario('orage', aScenario('d', 'g3'), 's1', 't3');
    convention.signUpForGame('p1', 'epice', PROGRAMMING_CATALOGUE);
    convention.signUpForGame('p2', 'epice', PROGRAMMING_CATALOGUE);
    convention.signUpForGame('p3', 'brumes', PROGRAMMING_CATALOGUE);
    convention.launchDraw('s1', PROGRAMMING_CATALOGUE, FIRST_GAME, RANDOM);
    return convention;
  }

  const KEPT = ['p1 epice', 'p2 epice', 'p3 brumes'];
  const ASSIGNED = ['p3 brumes', 'p1 epice', 'p2 epice'];
  const signUpsOf = (convention: Convention) =>
    convention.signUps.map(({ participantId, gameId }) => `${participantId} ${gameId}`);

  describe('effacent le tirage provisoire et rouvrent les inscriptions', () => {
    it('programmer sur le créneau', () => {
      const convention = aDrawingConvention();

      convention.scheduleScenario('foret', aScenario('e', 'g4'), 's1', 't4');

      expect(convention.draws).toEqual([]);
      expect(stateOf(convention, 's1')).toBe('sign-ups-open');
      expect(signUpsOf(convention)).toEqual(KEPT);
    });

    it('déplacer une partie vers le créneau', () => {
      const convention = aDrawingConvention();
      convention.scheduleScenario('foret', aScenario('e', 'g4'), 's3', 't1');
      expect(assignmentsOf(convention, 's1')).toEqual(ASSIGNED);

      convention.moveGame('foret', 's1', 't4');

      expect(convention.draws).toEqual([]);
    });

    it('déplacer une partie hors du créneau, puis IN-6 : ses inscrits la perdent, et restent sans partie', () => {
      const convention = aDrawingConvention();

      convention.moveGame('brumes', 's3', 't1');

      expect(convention.draws).toEqual([]);
      expect(signUpsOf(convention)).toEqual(['p1 epice', 'p2 epice']);
      expect(convention.participantsWithoutGame).toEqual([new ParticipantWithoutGame('p3', 's1')]);
    });

    it('échanger deux parties de créneaux différents, dont l’une y commence', () => {
      const convention = aDrawingConvention();

      convention.swapGames('brumes', 'neons');

      expect(convention.draws).toEqual([]);
    });

    it('déprogrammer une de ses parties', () => {
      const convention = aDrawingConvention();

      convention.unscheduleGame('orage');

      expect(convention.draws).toEqual([]);
    });

    it('avec ses parties annulées : leur MJ mène de nouveau', () => {
      const convention = aDrawingConvention();
      convention.cancelGame('brumes', PROGRAMMING_CATALOGUE);

      convention.unscheduleGame('orage');

      expect(convention.draws).toEqual([]);
      expect(convention.computeParticipantSituation('p-g1', NOW).timeSlots[0]!.ledGameId).toBe(
        'brumes',
      );
    });
  });

  describe('gardent le tirage : les joueurs suivent leur partie', () => {
    it('changer de table dans le créneau', () => {
      const convention = aDrawingConvention();

      convention.moveGame('brumes', 's1', 't4');

      expect(stateOf(convention, 's1')).toBe('drawing');
      expect(assignmentsOf(convention, 's1')).toEqual(ASSIGNED);
    });

    it('échanger deux parties du créneau', () => {
      const convention = aDrawingConvention();

      convention.swapGames('brumes', 'orage');

      expect(assignmentsOf(convention, 's1')).toEqual(ASSIGNED);
    });

    it('un geste sur d’autres créneaux', () => {
      const convention = aDrawingConvention();

      convention.scheduleScenario('foret', aScenario('e', 'g4'), 's3', 't1');
      convention.moveGame('foret', 's3', 't2');

      expect(assignmentsOf(convention, 's1')).toEqual(ASSIGNED);
    });
  });

  describe('notifications : « Les inscriptions du créneau sont rouvertes » (NO-2)', () => {
    const reopenedOf = (notifications: Notification[]) =>
      notifications.map(({ code, params }) => `${code} ${'reopened' in params && params.reopened}`);

    it('« nouvelle partie », aussi en secours, et « tu mènes » sur le créneau rouvert', () => {
      expect(
        reopenedOf(
          aDrawingConvention().scheduleScenario('foret', aScenario('e', 'g4'), 's1', 't4'),
        ),
      ).toEqual(['new-game true', 'new-game true', 'own-game-scheduled false']);
    });

    it('« partie retirée du programme » à ses inscrits et à son MJ', () => {
      expect(reopenedOf(aDrawingConvention().unscheduleGame('brumes'))).toEqual([
        'game-unscheduled true',
        'own-game-unscheduled true',
      ]);
    });

    it('« partie déplacée » hors du créneau rouvert, ou vers lui', () => {
      expect(reopenedOf(aDrawingConvention().moveGame('brumes', 's3', 't1'))).toEqual([
        'game-moved true',
        'new-game false',
        'own-game-scheduled false',
      ]);
      const convention = aDrawingConvention();
      convention.scheduleScenario('foret', aScenario('e', 'g4'), 's3', 't1');
      convention.reopenSignUps('s1');
      convention.withdrawFromGame('p3', 'brumes');
      convention.signUpForGame('p3', 'foret', PROGRAMMING_CATALOGUE);
      convention.launchDraw('s1', PROGRAMMING_CATALOGUE, FIRST_GAME, RANDOM);
      expect(reopenedOf(convention.moveGame('foret', 's1', 't4'))).toEqual([
        'game-moved true',
        'new-game true',
        'new-game true',
        'own-game-scheduled false',
      ]);
    });

    it('rien de tel sur un créneau sans tirage', () => {
      expect(
        reopenedOf(
          aDrawingConvention().scheduleScenario('foret', aScenario('e', 'g4'), 's3', 't1'),
        ),
      ).toEqual(['new-game false', 'own-game-scheduled false']);
    });
  });

  describe('verdicts : le créneau dont le geste effacerait le tirage', () => {
    it('programmer', () => {
      const convention = aDrawingConvention();
      const erasedAt = (timeSlotId: string, tableId: string) =>
        convention
          .computePlacementVerdicts(aScenario('e', 'g4'))
          .find((verdict) => verdict.timeSlotId === timeSlotId && verdict.tableId === tableId)
          ?.erasedDrawTimeSlotId;

      expect(erasedAt('s1', 't4')).toBe('s1');
      expect(erasedAt('s3', 't1')).toBeNull();
      // Une case refusée n'efface rien : la table 1 est prise.
      expect(erasedAt('s1', 't1')).toBeNull();
    });

    it('programmer sur une case', () => {
      const verdicts = aDrawingConvention().computeCellPlacementVerdicts(
        PROGRAMMING_CATALOGUE,
        's1',
        't4',
      );

      expect(verdicts.find(({ scenarioId }) => scenarioId === 'e')?.erasedDrawTimeSlotId).toBe(
        's1',
      );
    });

    it('déplacer ou échanger', () => {
      const verdicts = aDrawingConvention().computeMoveVerdicts('brumes');
      const erasedAt = (timeSlotId: string, tableId: string) =>
        verdicts.find((verdict) => verdict.timeSlotId === timeSlotId && verdict.tableId === tableId)
          ?.erasedDrawTimeSlotId;

      expect(erasedAt('s1', 't4')).toBeNull();
      expect(erasedAt('s1', 't3')).toBeNull();
      expect(erasedAt('s3', 't1')).toBe('s1');
      expect(erasedAt('s2', 't1')).toBe('s1');
    });

    it('déprogrammer', () => {
      const convention = aDrawingConvention();

      expect(convention.computeUnscheduleVerdict('orage').erasedDrawTimeSlotId).toBe('s1');
      expect(convention.computeUnscheduleVerdict('neons').erasedDrawTimeSlotId).toBeNull();
    });
  });
});

describe('Participant sans partie dans le tirage (TI-2)', () => {
  const trackingOf = (convention: Convention, timeSlotId: string) =>
    convention.computeSignUpTracking(CATALOGUE).find((slot) => slot.timeSlotId === timeSlotId)!;

  /**
   * Élodie inscrite à « brumes », Lune à « épice ». « brumes » est déprogrammée : Élodie est sans
   * partie sur le créneau 1.
   */
  function aConventionWithParticipantWithoutGame(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.unscheduleGame('brumes');
    return convention;
  }

  it('entre au tirage au lancement : l’algorithme le reçoit sans partie', () => {
    const convention = aConventionWithParticipantWithoutGame();
    const algorithm = new FakeDrawAlgorithm();

    convention.launchDraw('s1', CATALOGUE, algorithm, RANDOM);

    expect(algorithm.received?.participants).toEqual([
      { id: 'p2', gameIds: ['epice'] },
      { id: 'p1', gameIds: [] },
    ]);
    expect(assignmentsOf(convention, 's1')).toEqual(['p2 -', 'p1 -']);
  });

  it('entre au tirage à la relance', () => {
    const convention = aConventionWithParticipantWithoutGame();
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.moveParticipant('s1', 'p1', 'epice');
    const algorithm = new FakeDrawAlgorithm();

    convention.rerunDraw('s1', CATALOGUE, algorithm, RANDOM);

    expect(algorithm.received?.participants).toEqual([
      { id: 'p2', gameIds: ['epice'] },
      { id: 'p1', gameIds: [] },
    ]);
  });

  it('reste hors du tirage du créneau suivant une partie double publiée où il est placé (TI-3)', () => {
    const base = aConvention();
    base.signUpForGame('p1', 'epice', CATALOGUE);
    const convention = Convention.restore({
      ...stateOfConvention(base),
      participantsWithoutGame: [new ParticipantWithoutGame('p1', 's2')],
      draws: [new Draw('s1', true, [new Assignment('p1', 'epice', false)])],
    });
    const algorithm = new FakeDrawAlgorithm();

    convention.launchDraw('s2', CATALOGUE, algorithm, RANDOM);

    expect(algorithm.received?.participants).toEqual([]);
  });

  it('porte « sans partie » dans les affectations lues', () => {
    const convention = aConventionWithParticipantWithoutGame();
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    const assignments = trackingOf(convention, 's1').draw!.assignments;

    expect(
      assignments.map(({ participantId, withoutGame }) => `${participantId} ${withoutGame}`),
    ).toEqual(['p1 true', 'p2 false']);
  });

  it('porte « sans partie » pour le MJ d’une partie annulée sans inscription active à une partie maintenue', () => {
    const convention = aConvention();
    convention.unscheduleGame('epice');
    convention.signUpForGame('p-g2', 'brumes', CATALOGUE);
    convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    convention.cancelGame('brumes', CATALOGUE);
    convention.cancelGame('epice', CATALOGUE);

    const withoutGame = Object.fromEntries(
      trackingOf(convention, 's1').draw!.assignments.map(({ participantId, withoutGame }) => [
        participantId,
        withoutGame,
      ]),
    );
    // Kaïros reste inscrit à « brumes », mais elle est annulée : il est sans partie, comme Brann.
    expect(withoutGame).toEqual({ 'p-g1': true, 'p-g2': true });
  });

  it('se place à la main, sur une partie où il n’est pas inscrit', () => {
    const convention = aConventionWithParticipantWithoutGame();
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);

    convention.moveParticipant('s1', 'p1', 'epice');

    expect(assignmentsOf(convention, 's1')).toEqual(['p2 epice', 'p1 epice']);
    expect(trackingOf(convention, 's1').draw!.assignments[0]).toMatchObject({
      participantId: 'p1',
      gameId: 'epice',
      movedByHand: true,
      playsWithoutSignUp: true,
      withoutGame: true,
    });
  });

  it('reçoit à la publication « pas de place », en sachant qu’il n’avait plus d’inscription', () => {
    const convention = aConventionWithParticipantWithoutGame();
    convention.signUpForGame('p3', 'epice', CATALOGUE);
    convention.launchDraw(
      's1',
      CATALOGUE,
      new FakeDrawAlgorithm(() => [
        { participantId: 'p2', gameId: 'epice' },
        { participantId: 'p3', gameId: null },
        { participantId: 'p1', gameId: null },
      ]),
      RANDOM,
    );

    const unassigned = convention
      .publishDraw('s1', CATALOGUE)
      .filter(({ code }) => code === 'draw-unassigned')
      .map(({ params, recipients }) => ({ params, recipients: recipients.participantIds }));

    expect(unassigned).toEqual([
      { params: { rank: 1, tablesWithSeats: ['Table 2'], withoutGame: false }, recipients: ['p3'] },
      { params: { rank: 1, tablesWithSeats: ['Table 2'], withoutGame: true }, recipients: ['p1'] },
    ]);
  });
});

describe('Gestes de programmation sur un créneau publié (TI-7)', () => {
  /**
   * Celle d'`aConvention()`, avec la table t3 et la MJ Ysolde (g3), disponible sur les trois
   * créneaux, comme Brann pour le créneau 3. Élodie est inscrite à « brumes », Lune à « épice ». Le
   * tirage du créneau 1 est publié, chacune sur sa partie : « épice », partie double, en sort figée.
   */
  function aPublishedConvention(): Convention {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.addGameMaster('g3', 'p-g3', 'Ysolde');
    for (const slot of ['s1', 's2', 's3']) convention.declareGameMasterAvailability('g3', slot);
    convention.declareGameMasterAvailability('g1', 's3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.publishDraw('s1', CATALOGUE);
    return convention;
  }

  const PUBLISHED = new Refusal('time-slot-published', { rank: 1 });

  describe('sont refusés', () => {
    it('programmer sur le créneau', () => {
      expect(
        refusalOf(() =>
          aPublishedConvention().scheduleScenario('orage', aScenario('d', 'g3'), 's1', 't3'),
        ),
      ).toEqual(PUBLISHED);
    });

    it('déplacer une partie vers le créneau', () => {
      const convention = aPublishedConvention();
      convention.scheduleScenario('orage', aScenario('d', 'g3'), 's3', 't3');

      expect(refusalOf(() => convention.moveGame('orage', 's1', 't3'))).toEqual(PUBLISHED);
    });

    it('déplacer une partie hors du créneau', () => {
      expect(refusalOf(() => aPublishedConvention().moveGame('brumes', 's3', 't1'))).toEqual(
        PUBLISHED,
      );
    });

    it('changer de table dans le créneau', () => {
      expect(refusalOf(() => aPublishedConvention().moveGame('brumes', 's1', 't3'))).toEqual(
        PUBLISHED,
      );
    });

    it('échanger avec une partie du créneau, depuis un autre créneau ou dans le créneau', () => {
      const convention = aPublishedConvention();
      convention.scheduleScenario('orage', aScenario('d', 'g3'), 's3', 't3');

      expect(refusalOf(() => convention.swapGames('orage', 'brumes'))).toEqual(PUBLISHED);
      expect(refusalOf(() => convention.swapGames('brumes', 'epice'))).toEqual(PUBLISHED);
    });

    it('déprogrammer une de ses parties', () => {
      expect(refusalOf(() => aPublishedConvention().unscheduleGame('brumes'))).toEqual(PUBLISHED);
    });

    it('déplacer ou déprogrammer une partie double qui y commence : elle est figée sur ses deux créneaux', () => {
      const convention = aPublishedConvention();

      expect(refusalOf(() => convention.moveGame('epice', 's2', 't3'))).toEqual(PUBLISHED);
      expect(refusalOf(() => convention.unscheduleGame('epice'))).toEqual(PUBLISHED);
    });
  });

  describe('les verdicts le montrent, avant PR-5', () => {
    it('programmer : chaque case du créneau', () => {
      const refusals = aPublishedConvention()
        .computePlacementVerdicts(aScenario('d', 'g3'))
        .filter(({ timeSlotId }) => timeSlotId === 's1')
        .map(({ refusal }) => refusal);

      // Les tables 1 et 2 sont prises, mais le créneau publié l'emporte.
      expect(refusals).toEqual([PUBLISHED, PUBLISHED, PUBLISHED]);
    });

    it('programmer sur une case du créneau', () => {
      const verdicts = aPublishedConvention().computeCellPlacementVerdicts(
        ScenarioCatalogue.restore([
          ...CATALOGUE.listEntries(),
          { id: 'd', gameMasterId: 'g3', duration: 1, minSeats: 3, maxSeats: 5 },
        ]),
        's1',
        't3',
      );

      expect(verdicts.map(({ scenarioId, refusal }) => [scenarioId, refusal])).toEqual([
        ['c', PUBLISHED],
        ['d', PUBLISHED],
      ]);
    });

    it('déplacer ou échanger une partie du créneau : chaque case', () => {
      const refusals = aPublishedConvention()
        .computeMoveVerdicts('brumes')
        .map(({ refusal }) => refusal);

      expect(refusals.every((refusal) => refusal?.code === 'time-slot-published')).toBe(true);
    });

    it('déplacer une autre partie : les cases du créneau seulement', () => {
      const verdicts = aPublishedConvention().computeMoveVerdicts('neons');
      const refusalAt = (timeSlotId: string, tableId: string) =>
        verdicts.find((verdict) => verdict.timeSlotId === timeSlotId && verdict.tableId === tableId)
          ?.refusal;

      expect(refusalAt('s1', 't3')).toEqual(PUBLISHED);
      expect(refusalAt('s3', 't3')).toBeNull();
    });

    it('déprogrammer', () => {
      expect(refusalOf(() => aPublishedConvention().computeUnscheduleVerdict('brumes'))).toEqual(
        PUBLISHED,
      );
    });
  });

  describe('restent permis', () => {
    it('programmer sur le second créneau de la partie double, à une autre table', () => {
      const convention = aPublishedConvention();

      convention.scheduleScenario('orage', aScenario('d', 'g3'), 's2', 't3');

      expect(convention.games.map(({ id }) => id)).toContain('orage');
    });

    it('changer les places d’un scénario du créneau (PR-4)', () => {
      expect(
        aPublishedConvention().buildOversubscribedNotificationsAfterSeatsChange(
          aScenario('a', 'g1'),
          Seats.createBetween(5, 8),
        ),
      ).toEqual([]);
    });

    it('déclarer et retirer une disponibilité sur le créneau, où le MJ ne mène pas (PR-15)', () => {
      const convention = aPublishedConvention();

      convention.withdrawGameMasterAvailability('g3', 's1');
      convention.declareGameMasterAvailability('g3', 's1');

      expect(convention.countAvailabilitiesOnTimeSlot('s1')).toBe(3);
    });

    it('ajouter une table, renommer celle d’une partie publiée, changer le pseudo d’un MJ', () => {
      const convention = aPublishedConvention();

      convention.addTable('t4', 'Table 4');
      convention.renameTable('t1', 'Dragon');
      convention.changeGameMasterNickname('g1', 'Brann le Sage');

      expect(convention.tables.map(({ name }) => name.text)).toContain('Dragon');
      expect(convention.gameMasters.map(({ nickname }) => nickname.text)).toContain(
        'Brann le Sage',
      );
    });
  });
});

describe('Créneaux tirés (PR-10, PR-11)', () => {
  /** Celle d'`aConvention()`, le tirage du créneau 1 lancé. */
  function aDrawingConvention(): Convention {
    const convention = aConvention();
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    return convention;
  }

  /** Celle d'`aConvention()`, le tirage du créneau 1 publié. */
  function aPublishedConvention(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.publishDraw('s1', CATALOGUE);
    return convention;
  }

  describe('ajouter un créneau', () => {
    it('refuse un créneau avant un créneau en tirage provisoire', () => {
      expect(
        refusalOf(() => aDrawingConvention().addTimeSlot('s0', at('07:00'), at('08:30'))),
      ).toEqual(new Refusal('time-slot-before-draw', { rank: 1, published: false }));
    });

    it('refuse un créneau avant un créneau publié', () => {
      expect(
        refusalOf(() => aPublishedConvention().addTimeSlot('s0', at('07:00'), at('08:30'))),
      ).toEqual(new Refusal('time-slot-before-draw', { rank: 1, published: true }));
    });

    it('ajoute un créneau après les créneaux tirés', () => {
      const convention = aDrawingConvention();

      convention.addTimeSlot('s4', at('20:00'), at('22:00'));

      expect(convention.getTimeSlotRank('s4')).toBe(4);
    });

    it('fait passer d’abord les refus existants', () => {
      expect(
        refusalOf(() => aDrawingConvention().addTimeSlot('s0', at('08:00'), at('10:00'))),
      ).toEqual(new Refusal('time-slot-end-overlaps', { rank: 1 }));
    });
  });

  /**
   * Une journée sans partie : créneaux s1, s2 et s3. Le tirage du créneau 1 est publié, celui du
   * créneau 2 lancé, tous deux vides.
   */
  function aDayWithoutGames(): Convention {
    const convention = Convention.restore({
      ...stateOfConvention(aConvention()),
      timeSlots: [],
      tables: [],
      gameMasters: [],
      participants: [],
      signUps: [],
      games: [],
    });
    convention.addTimeSlot('s1', at('09:00'), at('11:30'));
    convention.addTimeSlot('s2', at('14:00'), at('16:30'));
    convention.addTimeSlot('s3', at('17:00'), at('19:30'));
    convention.launchDraw('s1', CATALOGUE, FIRST_GAME, RANDOM);
    convention.publishDraw('s1', CATALOGUE);
    convention.launchDraw('s2', CATALOGUE, FIRST_GAME, RANDOM);
    return convention;
  }

  describe('changer les heures d’un créneau', () => {
    it('refuse un créneau dont le tirage est publié, puis lancé', () => {
      const convention = aDayWithoutGames();

      expect(
        refusalOf(() => convention.changeTimeSlotHours('s1', at('08:00'), at('11:30'))),
      ).toEqual(new Refusal('time-slot-locked-by-draw', { rank: 1, published: true }));
      expect(
        refusalOf(() => convention.changeTimeSlotHours('s2', at('14:00'), at('16:00'))),
      ).toEqual(new Refusal('time-slot-locked-by-draw', { rank: 2, published: false }));
    });

    it('refuse de déplacer un créneau non tiré avant un créneau tiré', () => {
      expect(
        refusalOf(() => aDayWithoutGames().changeTimeSlotHours('s3', at('12:00'), at('13:30'))),
      ).toEqual(new Refusal('time-slot-before-draw', { rank: 2, published: false }));
    });

    it('change les heures d’un créneau non tiré qui reste après les créneaux tirés', () => {
      const convention = aDayWithoutGames();

      convention.changeTimeSlotHours('s3', at('18:00'), at('20:00'));

      expect(convention.timeSlots[2]!.start).toEqual(at('18:00'));
    });

    it('fait passer d’abord les refus existants : parties, puis disponibilités', () => {
      expect(
        refusalOf(() => aDrawingConvention().changeTimeSlotHours('s1', at('08:00'), at('11:30'))),
      ).toEqual(new Refusal('time-slot-hours-locked-by-games', { rank: 1, games: 2 }));
      const convention = aDayWithoutGames();
      convention.addGameMaster('g1', 'p-g1', 'Brann');
      convention.declareGameMasterAvailability('g1', 's2');
      expect(
        refusalOf(() => convention.changeTimeSlotHours('s2', at('14:00'), at('16:00'))),
      ).toEqual(new Refusal('time-slot-hours-locked', { rank: 2, availabilities: 1 }));
    });
  });

  describe('supprimer un créneau', () => {
    it('refuse un créneau dont le tirage est publié, puis lancé', () => {
      const convention = aDayWithoutGames();

      expect(refusalOf(() => convention.removeTimeSlot('s1'))).toEqual(
        new Refusal('time-slot-locked-by-draw', { rank: 1, published: true }),
      );
      expect(refusalOf(() => convention.removeTimeSlot('s2'))).toEqual(
        new Refusal('time-slot-locked-by-draw', { rank: 2, published: false }),
      );
    });

    it('supprime un créneau non tiré', () => {
      const convention = aDayWithoutGames();

      convention.removeTimeSlot('s3');

      expect(convention.timeSlots.map(({ id }) => id)).toEqual(['s1', 's2']);
    });

    it('fait passer d’abord le refus d’un créneau qui porte des parties', () => {
      expect(refusalOf(() => aDrawingConvention().removeTimeSlot('s1'))).toEqual(
        new Refusal('time-slot-has-games', { rank: 1, games: 2 }),
      );
    });
  });
});
