import { describe, expect, it } from 'vitest';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { Convention } from './convention.js';
import type { LocalMoment } from './local-moment.js';
import { PresenceCode } from './presence-code.js';
import { TimeOfDay } from './time-of-day.js';

// Le suivi des inscriptions de chaque créneau, à travers `Convention` : son interface est la surface de test.

const at = TimeOfDay.parse;
const NOW: LocalMoment = { date: '2027-03-14', time: at('08:00') };

const SEATS: Record<string, { min: number; max: number }> = {
  a: { min: 3, max: 5 },
  b: { min: 2, max: 4 },
  c: { min: 4, max: 6 },
};
const DURATIONS: Record<string, Duration> = { a: 1, b: 2, c: 1 };
const GAME_MASTERS: Record<string, string> = { a: 'g1', b: 'g2', c: 'g3' };

function aScenario(id: string): Scenario {
  return Scenario.propose(id, GAME_MASTERS[id]!, {
    title: `Scénario ${id}`,
    system: 'Cthulhu',
    presentation: 'Une enquête.',
    contentWarnings: '',
    seats: SEATS[id]!,
    duration: DURATIONS[id]!,
  });
}

/** Les scénarios a (3 à 5 places), b (double, 2 à 4) et c (4 à 6). */
const CATALOGUE = ScenarioCatalogue.restore(
  Object.keys(SEATS).map((id) => ({
    id,
    gameMasterId: GAME_MASTERS[id]!,
    duration: DURATIONS[id]!,
    minSeats: SEATS[id]!.min,
    maxSeats: SEATS[id]!.max,
  })),
);

/**
 * Créneaux s1 (9 h – 11 h 30), s2 (14 h – 16 h 30) et s3 (17 h – 19 h 30), tables t1 et t2. Au
 * créneau 1 : « brumes » (a, t1) et « epice », partie double des créneaux 1 et 2 (b, t2). Au
 * créneau 2 : « neons » (c, t1). Brann (g1), Kaïros (g2) et Mira (g3) les mènent. Les participants « Élodie »
 * (p1), « Lune » (p2) et « Sven » (p3) se sont identifiés.
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
  convention.addGameMaster('g3', 'p-g3', 'Mira');
  for (const slot of ['s1', 's2', 's3']) {
    for (const gameMaster of ['g1', 'g2', 'g3']) {
      convention.declareGameMasterAvailability(gameMaster, slot);
    }
  }
  convention.scheduleScenario('brumes', aScenario('a'), 's1', 't1');
  convention.scheduleScenario('epice', aScenario('b'), 's1', 't2');
  convention.scheduleScenario('neons', aScenario('c'), 's2', 't1');
  for (const [id, nickname] of [
    ['p1', 'Élodie'],
    ['p2', 'Lune'],
    ['p3', 'Sven'],
  ] as const) {
    convention.identifyByNickname(id, 'K7M2', nickname, null, NOW);
  }
  return convention;
}

/** Inscrit chaque participant aux parties données. */
function signUp(convention: Convention, signUps: Record<string, string[]>): void {
  for (const [participantId, gameIds] of Object.entries(signUps)) {
    for (const gameId of gameIds) convention.signUpForGame(participantId, gameId, CATALOGUE);
  }
}

/** Le suivi, créneau par créneau, en « demande, capacité minimum, capacité maximum ». */
const listFiguresByTimeSlot = (convention: Convention) =>
  convention
    .computeSignUpTracking(CATALOGUE)
    .map(({ demand, capacity }) => [demand, capacity.min, capacity.max]);

describe('Suivi des inscriptions de chaque créneau (§4.4)', () => {
  it('rend chaque créneau dans l’ordre de la journée, avec son état', () => {
    const tracking = aConvention().computeSignUpTracking(CATALOGUE);

    expect(tracking.map(({ timeSlotId, state }) => [timeSlotId, state])).toEqual([
      ['s1', 'sign-ups-open'],
      ['s2', 'sign-ups-open'],
      ['s3', 'sign-ups-open'],
    ]);
  });

  it('compte la demande en participants distincts, et la capacité en fourchette', () => {
    const convention = aConvention();
    signUp(convention, { p1: ['brumes', 'epice'], p2: ['brumes'], p3: ['neons'] });

    expect(listFiguresByTimeSlot(convention)).toEqual([
      [2, 5, 9],
      [1, 4, 6],
      [0, 0, 0],
    ]);
  });

  it('ne compte une partie double que sur son premier créneau', () => {
    const convention = aConvention();
    signUp(convention, { p1: ['epice'], p2: ['epice', 'neons'] });

    // Sur s2, « epice » n'entre ni dans la demande ni dans la capacité : Lune y compte par « neons ».
    expect(listFiguresByTimeSlot(convention)[1]).toEqual([1, 4, 6]);
    expect(listFiguresByTimeSlot(convention)[0]).toEqual([2, 5, 9]);
  });

  it('ne compte pas l’inscription d’un MJ qui mène sur le créneau (IN-4)', () => {
    const convention = aConvention();
    // Mira (p-g3) s'inscrit à « epice » (s1 et s2), puis mène « neons » sur s2 : son inscription n'est plus active.
    convention.unscheduleGame('neons');
    signUp(convention, { 'p-g3': ['epice'], p1: ['epice'] });
    convention.scheduleScenario('neons', aScenario('c'), 's2', 't1');

    expect(listFiguresByTimeSlot(convention)[0]).toEqual([1, 5, 9]);
  });

  it('compte de nouveau l’inscription du MJ quand sa partie quitte le créneau', () => {
    const convention = aConvention();
    convention.unscheduleGame('neons');
    signUp(convention, { 'p-g3': ['epice'], p1: ['epice'] });
    convention.scheduleScenario('neons', aScenario('c'), 's2', 't1');

    convention.moveGame('neons', 's3', 't1');

    expect(listFiguresByTimeSlot(convention)[0]).toEqual([2, 5, 9]);
  });
});

/** Identifie d'autres participants, sous le pseudo de leur id. */
function identify(convention: Convention, ids: string[]): void {
  for (const id of ids) convention.identifyByNickname(id, 'K7M2', id, null, NOW);
}

/** Les chiffres des parties qui commencent sur le créneau de rang `rank`. */
const listGamesOfTimeSlot = (convention: Convention, rank: number) =>
  convention.computeSignUpTracking(CATALOGUE)[rank - 1]!.games;

describe('Suivi des parties de chaque créneau (§4.4)', () => {
  it('rend les inscrits de chaque partie qui commence sur le créneau, et ceux sans autre inscription', () => {
    const convention = aConvention();
    signUp(convention, { p1: ['brumes', 'epice'], p2: ['brumes'], p3: ['epice'] });

    expect(listGamesOfTimeSlot(convention, 1)).toEqual([
      {
        gameId: 'brumes',
        signUpCount: 2,
        withoutOtherSignUpCount: 1,
        oversubscribed: false,
        belowMinimum: true,
        surplusSignUpCount: 0,
        missingSignUpCount: 1,
      },
      {
        gameId: 'epice',
        signUpCount: 2,
        withoutOtherSignUpCount: 1,
        oversubscribed: false,
        belowMinimum: false,
        surplusSignUpCount: 0,
        missingSignUpCount: 0,
      },
    ]);
  });

  it('ne rend une partie double que sur son premier créneau', () => {
    const convention = aConvention();
    signUp(convention, { p1: ['epice'], p2: ['neons'] });

    expect(listGamesOfTimeSlot(convention, 2).map(({ gameId }) => gameId)).toEqual(['neons']);
  });

  it('dit « très demandée » quand les inscrits dépassent les places maximum (IN-5)', () => {
    const convention = aConvention();
    identify(convention, ['p4', 'p5']);
    signUp(convention, { p1: ['epice'], p2: ['epice'], p3: ['epice'], p4: ['epice'] });

    expect(listGamesOfTimeSlot(convention, 1)[1]!.oversubscribed).toBe(false);

    signUp(convention, { p5: ['epice'] });

    expect(listGamesOfTimeSlot(convention, 1)[1]!.oversubscribed).toBe(true);
  });

  it('compte les inscrits de trop au-delà du maximum, et ceux qui manquent pour le minimum', () => {
    const convention = aConvention();
    identify(convention, ['p4', 'p5', 'p6']);
    signUp(convention, { p1: ['epice'], p2: ['epice'], p3: ['epice'], p4: ['epice'] });
    signUp(convention, { p5: ['epice'], p6: ['epice', 'brumes'] });

    // « epice » : 6 inscrits pour 2 à 4 places ; « brumes » : 1 inscrit pour 3 à 5 places.
    expect(
      listGamesOfTimeSlot(convention, 1).map(({ surplusSignUpCount, missingSignUpCount }) => [
        surplusSignUpCount,
        missingSignUpCount,
      ]),
    ).toEqual([
      [0, 2],
      [2, 0],
    ]);
  });

  it('ne compte aucun inscrit manquant sur un créneau sans inscription', () => {
    expect(
      listGamesOfTimeSlot(aConvention(), 1).map(({ missingSignUpCount }) => missingSignUpCount),
    ).toEqual([0, 0]);
  });

  it('dit « sous son minimum » d’une partie sans inscrit, dès que le créneau en a', () => {
    const convention = aConvention();

    expect(listGamesOfTimeSlot(convention, 1).map(({ belowMinimum }) => belowMinimum)).toEqual([
      false,
      false,
    ]);

    signUp(convention, { p1: ['brumes'], p2: ['brumes'], p3: ['brumes'] });

    expect(listGamesOfTimeSlot(convention, 1).map(({ belowMinimum }) => belowMinimum)).toEqual([
      false,
      true,
    ]);
  });

  it('ne compte pas l’inscription d’un MJ qui mène sur le créneau (IN-4)', () => {
    const convention = aConvention();
    convention.unscheduleGame('neons');
    signUp(convention, { 'p-g3': ['epice'], p1: ['epice'] });
    convention.scheduleScenario('neons', aScenario('c'), 's2', 't1');

    expect(listGamesOfTimeSlot(convention, 1)[1]).toMatchObject({
      signUpCount: 1,
      withoutOtherSignUpCount: 1,
    });
  });

  it('donne à une partie les chiffres des inscriptions qu’un geste lui retirerait (IN-6)', () => {
    const convention = aConvention();
    convention.unscheduleGame('neons');
    signUp(convention, { 'p-g3': ['epice'], p1: ['brumes', 'epice'], p2: ['brumes'] });
    signUp(convention, { p3: ['epice'] });
    convention.scheduleScenario('neons', aScenario('c'), 's2', 't1');
    signUp(convention, { p2: ['neons'] });
    /** Les chiffres du suivi de la partie, sur son premier créneau. */
    const trackedFiguresOf = (gameId: string) => {
      const tracked = convention
        .computeSignUpTracking(CATALOGUE)
        .flatMap(({ games }) => games)
        .find((game) => game.gameId === gameId)!;
      return {
        gameId,
        signUpCount: tracked.signUpCount,
        withoutOtherSignUpCount: tracked.withoutOtherSignUpCount,
      };
    };
    /** Les inscriptions retirées par le geste de la case, dans les verdicts de déplacement. */
    const removedOnMoveTo = (gameId: string, timeSlotId: string, tableId: string) =>
      convention
        .computeMoveVerdicts(gameId)
        .find((verdict) => verdict.timeSlotId === timeSlotId && verdict.tableId === tableId)!
        .removedSignUps;

    expect(trackedFiguresOf('epice')).toEqual({
      gameId: 'epice',
      signUpCount: 2,
      withoutOtherSignUpCount: 1,
    });
    for (const gameId of ['brumes', 'epice', 'neons']) {
      expect(convention.computeUnscheduleVerdict(gameId).removedSignUps).toEqual([
        trackedFiguresOf(gameId),
      ]);
    }
    expect(removedOnMoveTo('brumes', 's3', 't1')).toEqual([trackedFiguresOf('brumes')]);
    // Échanger « brumes » (créneau 1) et « neons » (créneau 2).
    expect(removedOnMoveTo('brumes', 's2', 't1')).toEqual([
      trackedFiguresOf('brumes'),
      trackedFiguresOf('neons'),
    ]);
  });
});

/** Les participants du créneau de rang `rank`, en « id, parties, risque ». */
const describeParticipantsOfTimeSlot = (convention: Convention, rank: number) =>
  convention
    .computeSignUpTracking(CATALOGUE)
    [rank - 1]!.participants.map(({ participantId, gameIds, risk }) => [
      participantId,
      gameIds,
      risk,
    ]);

describe('Participants de chaque créneau (§4.4)', () => {
  it('rend chaque participant avec ses parties du créneau, une seule inscription d’abord, puis par pseudo', () => {
    const convention = aConvention();
    identify(convention, ['Anna', 'Zoé']);
    signUp(convention, {
      p3: ['brumes'],
      p1: ['brumes', 'epice'],
      Zoé: ['epice', 'brumes'],
      Anna: ['epice'],
      p2: ['brumes', 'epice'],
    });

    // Sven (p3), puis Anna ; puis Élodie (p1), Lune (p2), Zoé. Les parties suivent l'ordre du Programme.
    expect(
      describeParticipantsOfTimeSlot(convention, 1).map(([id, gameIds]) => [id, gameIds]),
    ).toEqual([
      ['Anna', ['epice']],
      ['p3', ['brumes']],
      ['p1', ['brumes', 'epice']],
      ['p2', ['brumes', 'epice']],
      ['Zoé', ['brumes', 'epice']],
    ]);
  });

  it('ne rend aucun participant sur un créneau sans inscription', () => {
    expect(describeParticipantsOfTimeSlot(aConvention(), 1)).toEqual([]);
  });

  it('ne donne aucun risque à qui a une partie sûre sur le créneau', () => {
    const convention = aConvention();
    identify(convention, ['p4']);
    // « epice » : 2 inscrits pour 2 à 4 places, sûre ; « brumes » : 2 inscrits pour 3 à 5, sous son minimum.
    signUp(convention, { p1: ['brumes', 'epice'], p2: ['epice'], p4: ['brumes'] });

    expect(describeParticipantsOfTimeSlot(convention, 1)).toEqual([
      ['p2', ['epice'], null],
      ['p4', ['brumes'], 'may-be-left-without-table'],
      ['p1', ['brumes', 'epice'], null],
    ]);
  });

  it('dit qu’il risque de ne pas être placé quand toutes ses parties du créneau sont très demandées', () => {
    const convention = aConvention();
    identify(convention, ['p4', 'p5']);
    // « epice » : 5 inscrits pour 4 places au plus ; « brumes » : 1 inscrit pour 3 places au moins.
    signUp(convention, { p1: ['epice'], p2: ['epice'], p3: ['epice'], p4: ['epice'] });
    signUp(convention, { p5: ['epice', 'brumes'] });

    // Élodie (p1), Lune (p2), p4, Sven (p3), puis p5 et ses deux inscriptions.
    expect(describeParticipantsOfTimeSlot(convention, 1).map(([id, , risk]) => [id, risk])).toEqual(
      [
        ['p1', 'may-not-be-placed'],
        ['p2', 'may-not-be-placed'],
        ['p4', 'may-not-be-placed'],
        ['p3', 'may-not-be-placed'],
        ['p5', 'may-be-left-without-table'],
      ],
    );
  });

  it('ne rend pas le MJ qui mène sur le créneau (IN-4)', () => {
    const convention = aConvention();
    convention.unscheduleGame('neons');
    signUp(convention, { 'p-g3': ['epice'], p1: ['epice'] });
    convention.scheduleScenario('neons', aScenario('c'), 's2', 't1');

    expect(describeParticipantsOfTimeSlot(convention, 1).map(([id]) => id)).toEqual(['p1']);
  });

  it('ne rend une partie double que sur son premier créneau', () => {
    const convention = aConvention();
    signUp(convention, { p1: ['epice'], p2: ['epice', 'neons'] });

    expect(
      describeParticipantsOfTimeSlot(convention, 2).map(([id, gameIds]) => [id, gameIds]),
    ).toEqual([['p2', ['neons']]]);
  });
});

/** La réserve du créneau de rang `index + 1`, en « scénario, code du refus, paramètres ». */
const describeReserveOfTimeSlot = (convention: Convention, index: number) =>
  convention
    .computeSignUpTracking(CATALOGUE)
    [index]!.reserve.map(({ scenarioId, refusal }) => [
      scenarioId,
      refusal?.code ?? null,
      refusal?.params ?? null,
    ]);

describe('Réserve de chaque créneau (PR-6, §4.4 étape 2)', () => {
  it('rend programmable un scénario qu’une table au moins permet', () => {
    expect(describeReserveOfTimeSlot(aConvention(), 2)).toEqual([
      ['a', null, null],
      ['b', 'no-next-time-slot', { rank: 3 }],
      ['c', null, null],
    ]);
  });

  it('écarte un scénario qui a une partie qui commence sur le créneau', () => {
    // « brumes » (a) et « epice » (b) commencent sur le créneau 1.
    expect(describeReserveOfTimeSlot(aConvention(), 0).map(([id]) => id)).toEqual(['c']);
  });

  it('écarte un scénario dont le MJ n’est pas disponible sur le créneau', () => {
    const convention = aConvention();
    convention.withdrawGameMasterAvailability('g1', 's3');

    expect(describeReserveOfTimeSlot(convention, 2).map(([id]) => id)).toEqual(['b', 'c']);
  });

  it('donne le premier refus de ses cases qui n’est pas « table prise »', () => {
    // Sur le créneau 2, Kaïros mène déjà le second créneau de « epice » ; la table 1 porte « neons ».
    expect(describeReserveOfTimeSlot(aConvention(), 1)).toContainEqual([
      'b',
      'game-master-busy',
      { nickname: 'Kaïros', rank: 2 },
    ]);
  });

  it('dit que toutes les tables sont prises, pour un scénario simple', () => {
    expect(describeReserveOfTimeSlot(aConvention(), 1)).toContainEqual([
      'a',
      'no-free-table',
      { rank: 2, twoSlot: false },
    ]);
  });

  it('dit que toutes les tables sont prises, pour un scénario double', () => {
    const convention = aConvention();
    convention.unscheduleGame('epice');
    // Table 1 prise sur le créneau 2 par « neons », table 2 sur le créneau 3 par « brumes ».
    convention.moveGame('brumes', 's3', 't2');

    expect(describeReserveOfTimeSlot(convention, 1)).toContainEqual([
      'b',
      'no-free-table',
      { rank: 2, twoSlot: true },
    ]);
  });
});

/** Le catalogue, avec en plus les scénarios d (5 places tout juste) et e (1 place tout juste). */
const WARNING_CATALOGUE = ScenarioCatalogue.restore([
  ...CATALOGUE.listEntries(),
  { id: 'd', gameMasterId: 'g1', duration: 1, minSeats: 5, maxSeats: 5 },
  { id: 'e', gameMasterId: 'g2', duration: 1, minSeats: 1, maxSeats: 1 },
]);

/** Un scénario simple du catalogue des avertissements. */
function aWarningScenario(id: 'd' | 'e'): Scenario {
  const { minSeats, maxSeats, gameMasterId } = WARNING_CATALOGUE.findExistingEntryById(id);
  return Scenario.propose(id, gameMasterId, {
    title: `Scénario ${id}`,
    system: 'Cthulhu',
    presentation: 'Une enquête.',
    contentWarnings: '',
    seats: { min: minSeats, max: maxSeats },
    duration: 1,
  });
}

/** Identifie `count` participants de plus (« x1 », « x2 »…), inscrits aux parties données. */
function signUpOthers(
  convention: Convention,
  count: number,
  gameIds: string[],
  prefix = 'x',
): void {
  const ids = Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
  identify(convention, ids);
  for (const id of ids) {
    for (const gameId of gameIds) convention.signUpForGame(id, gameId, WARNING_CATALOGUE);
  }
}

/** La convention de `aConvention()`, sans « epice » : au créneau 1, « brumes » seule (3 à 5 places). */
function aConventionWithBrumesAlone(): Convention {
  const convention = aConvention();
  convention.unscheduleGame('epice');
  return convention;
}

/** Les avertissements de suivi du créneau de rang `rank`, en « code, niveau, paramètres ». */
const describeWarningsOfTimeSlot = (convention: Convention, rank: number) =>
  convention
    .computeSignUpTracking(WARNING_CATALOGUE)
    [rank - 1]!.warnings.map(({ code, level, params }) => [code, level, params]);

describe('Avertissements de suivi de chaque créneau (§4.4)', () => {
  it('n’en donne aucun sur un créneau sans inscription', () => {
    expect(describeWarningsOfTimeSlot(aConvention(), 1)).toEqual([]);
  });

  it('dit qu’il manque des places quand la demande dépasse la capacité maximum', () => {
    const convention = aConventionWithBrumesAlone();
    signUpOthers(convention, 6, ['brumes']);

    expect(describeWarningsOfTimeSlot(convention, 1)[0]).toEqual([
      'seats-missing',
      'danger',
      { demand: 6, maxCapacity: 5, missingSeats: 1 },
    ]);
  });

  it('dit combien de participants risquent de ne pas être placés, après les places qui manquent', () => {
    const convention = aConventionWithBrumesAlone();
    signUpOthers(convention, 7, ['brumes']);

    expect(describeWarningsOfTimeSlot(convention, 1)).toEqual([
      ['seats-missing', 'danger', { demand: 7, maxCapacity: 5, missingSeats: 2 }],
      ['participants-may-not-be-placed', 'danger', { participantCount: 7 }],
    ]);
  });

  it('dit « presque plein » à exactement 80 % de la capacité maximum', () => {
    const convention = aConventionWithBrumesAlone();
    signUpOthers(convention, 4, ['brumes']);

    expect(describeWarningsOfTimeSlot(convention, 1)).toEqual([
      ['nearly-full', 'warning', { demand: 4, maxCapacity: 5 }],
    ]);
  });

  it('dit « presque plein » à la capacité maximum', () => {
    const convention = aConventionWithBrumesAlone();
    signUpOthers(convention, 5, ['brumes']);

    expect(describeWarningsOfTimeSlot(convention, 1)).toEqual([
      ['nearly-full', 'warning', { demand: 5, maxCapacity: 5 }],
    ]);
  });

  it('ne dit rien sous 80 % de la capacité maximum, quand chaque partie est sûre', () => {
    const convention = aConventionWithBrumesAlone();
    signUpOthers(convention, 3, ['brumes']);

    expect(describeWarningsOfTimeSlot(convention, 1)).toEqual([]);
  });

  it('dit « trop de parties » quand la demande est sous la capacité minimum', () => {
    const convention = aConvention();
    signUp(convention, { p1: ['brumes'], p2: ['brumes'], p3: ['epice'] });
    signUpOthers(convention, 1, ['epice']);

    // Capacité de 5 à 9 places : « brumes » (2 inscrits pour 3 au moins) est sous son minimum.
    expect(describeWarningsOfTimeSlot(convention, 1)).toEqual([
      [
        'too-many-games',
        'warning',
        { demand: 4, minCapacity: 5, gamesBelowMinimum: 1, participantsMayBeLeftWithoutTable: 2 },
      ],
    ]);
  });

  it('dit combien de parties sont sous leur minimum quand la demande atteint la capacité minimum', () => {
    const convention = aConvention();
    signUpOthers(convention, 4, ['epice']);
    signUp(convention, { p1: ['brumes'] });

    expect(describeWarningsOfTimeSlot(convention, 1)).toEqual([
      [
        'games-below-minimum',
        'warning',
        { demand: 5, minCapacity: 5, gamesBelowMinimum: 1, participantsMayBeLeftWithoutTable: 1 },
      ],
    ]);
  });

  it('dit à la fois « presque plein » et « trop de parties » quand les minimums sont proches des maximums', () => {
    const convention = aConvention();
    // Au créneau 3, « dune » (d, 5 places tout juste) seule.
    convention.scheduleScenario('dune', aWarningScenario('d'), 's3', 't1');
    signUpOthers(convention, 4, ['dune']);

    expect(describeWarningsOfTimeSlot(convention, 3).map(([code]) => code)).toEqual([
      'nearly-full',
      'too-many-games',
    ]);
  });

  it('donne les rouges d’abord, trois au plus', () => {
    const convention = aConvention();
    // Au créneau 3 : « dune » (d, 5 places tout juste) et « eclat » (e, 1 place tout juste).
    convention.scheduleScenario('dune', aWarningScenario('d'), 's3', 't1');
    convention.scheduleScenario('eclat', aWarningScenario('e'), 's3', 't2');
    signUpOthers(convention, 3, ['dune']);
    signUpOthers(convention, 2, ['eclat'], 'y');

    expect(describeWarningsOfTimeSlot(convention, 3)).toEqual([
      ['participants-may-not-be-placed', 'danger', { participantCount: 2 }],
      ['nearly-full', 'warning', { demand: 5, maxCapacity: 6 }],
      [
        'too-many-games',
        'warning',
        { demand: 5, minCapacity: 6, gamesBelowMinimum: 1, participantsMayBeLeftWithoutTable: 3 },
      ],
    ]);
  });
});
