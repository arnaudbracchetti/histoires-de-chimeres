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
    expect(describeParticipantsOfTimeSlot(convention, 1).map(([id, , risk]) => [id, risk])).toEqual([
      ['p1', 'may-not-be-placed'],
      ['p2', 'may-not-be-placed'],
      ['p4', 'may-not-be-placed'],
      ['p3', 'may-not-be-placed'],
      ['p5', 'may-be-left-without-table'],
    ]);
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

    expect(describeParticipantsOfTimeSlot(convention, 2).map(([id, gameIds]) => [id, gameIds])).toEqual(
      [['p2', ['neons']]],
    );
  });
});
