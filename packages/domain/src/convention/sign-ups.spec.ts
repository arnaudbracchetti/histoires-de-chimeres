import { describe, expect, it } from 'vitest';
import { Account } from '../account/account.js';
import { Refusal } from '../refusal.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { Convention } from './convention.js';
import type { LocalMoment } from './local-moment.js';
import { PresenceCode } from './presence-code.js';
import { TimeOfDay } from './time-of-day.js';

/** L'Organisateur qui supprime, dont le pseudo n'est pas celui qu'il supprime (ID-16). */
const OTHER_ORGANIZER = Account.createForParticipant('a-other', 'p-other');
/** Aucun pseudo n'a de compte. */
const NO_ACCOUNTS: Account[] = [];

// Les règles des inscriptions (module `SignUps`), à travers `Convention` : son interface est la surface de test.

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
 * Créneaux s1 (9 h – 11 h 30) et s2 (14 h – 16 h 30), tables t1 et t2. Au créneau 1 : « brumes »
 * (t1) et « épice », partie double des créneaux 1 et 2 (t2). Au créneau 2 : « néons » (t1). Les
 * participants « Élodie » (p1) et « Lune » (p2) se sont identifiés.
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
  convention.addTable('t1', 'Table 1');
  convention.addTable('t2', 'Table 2');
  convention.addGameMaster('g1', 'p-g1', 'Brann');
  convention.addGameMaster('g2', 'p-g2', 'Kaïros');
  convention.declareGameMasterAvailability('g1', 's1');
  convention.declareGameMasterAvailability('g1', 's2');
  convention.declareGameMasterAvailability('g2', 's1');
  convention.declareGameMasterAvailability('g2', 's2');
  convention.scheduleScenario('brumes', aScenario('a', 'g1'), 's1', 't1');
  convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
  convention.scheduleScenario('neons', aScenario('c', 'g1'), 's2', 't1');
  convention.identifyByNickname('p1', 'K7M2', 'Élodie', null, NOW);
  convention.identifyByNickname('p2', 'K7M2', 'Lune', null, NOW);
  return convention;
}

/** Les scénarios a, b et c, à 5 places maximum. */
const CATALOGUE = ScenarioCatalogue.restore([
  { id: 'a', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
  { id: 'b', gameMasterId: 'g2', duration: 2, minSeats: 3, maxSeats: 5 },
  { id: 'c', gameMasterId: 'g1', duration: 1, minSeats: 3, maxSeats: 5 },
]);

function refusalOf(action: () => void): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error("L'action n'a pas été refusée.");
}

/** Les inscriptions, en « participant partie ». */
const signUpsOf = (convention: Convention) =>
  convention.signUps.map(({ participantId, gameId }) => `${participantId} ${gameId}`);

describe('S’inscrire à une partie (IN-2)', () => {
  it('inscrit le participant à la partie', () => {
    const convention = aConvention();

    const changed = convention.signUpForGame('p1', 'brumes', CATALOGUE);

    expect(changed).toEqual([]);
    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });

  it('inscrit à plusieurs parties d’un même créneau', () => {
    const convention = aConvention();

    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);

    expect(signUpsOf(convention)).toEqual(['p1 brumes', 'p1 epice']);
  });

  it('ne change rien à une inscription répétée', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    const changed = convention.signUpForGame('p1', 'brumes', CATALOGUE);

    expect(changed).toBeNull();
    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });

  it('refuse une partie introuvable', () => {
    expect(refusalOf(() => aConvention().signUpForGame('p1', 'inconnue', CATALOGUE)).code).toBe(
      'game-not-found',
    );
  });

  it('refuse un participant introuvable', () => {
    expect(refusalOf(() => aConvention().signUpForGame('inconnu', 'brumes', CATALOGUE)).code).toBe(
      'participant-not-found',
    );
  });

  it('garde les inscriptions prises sur le second créneau d’une partie double (IN-3)', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'neons', CATALOGUE);

    convention.signUpForGame('p1', 'epice', CATALOGUE);

    expect(signUpsOf(convention)).toEqual(['p1 neons', 'p1 epice']);
  });
});

describe('Se désinscrire d’une partie (IN-2)', () => {
  it('retire l’inscription du participant, et elle seule', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);

    const changed = convention.withdrawFromGame('p1', 'brumes');

    expect(changed).toBe(true);
    expect(signUpsOf(convention)).toEqual(['p1 epice', 'p2 brumes']);
  });

  it('ne change rien pour une partie où le participant n’est pas inscrit', () => {
    const convention = aConvention();

    const changed = convention.withdrawFromGame('p1', 'brumes');

    expect(changed).toBe(false);
    expect(signUpsOf(convention)).toEqual([]);
  });

  it('refuse une partie introuvable', () => {
    expect(refusalOf(() => aConvention().withdrawFromGame('p1', 'inconnue')).code).toBe(
      'game-not-found',
    );
  });

  it('refuse un participant introuvable', () => {
    expect(refusalOf(() => aConvention().withdrawFromGame('inconnu', 'brumes')).code).toBe(
      'participant-not-found',
    );
  });
});

describe('Gestes de programmation et inscriptions (IN-6)', () => {
  it('une partie déprogrammée perd ses inscriptions, et elles seules', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);

    convention.unscheduleGame('brumes');

    expect(signUpsOf(convention)).toEqual(['p1 epice']);
  });

  it('une partie déplacée sur un autre créneau perd ses inscriptions', () => {
    const convention = aConvention();
    convention.addTimeSlot('s3', at('18:00'), at('20:30'));
    convention.declareGameMasterAvailability('g1', 's3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);

    convention.moveGame('brumes', 's3', 't1');

    expect(signUpsOf(convention)).toEqual(['p1 epice']);
  });

  it('une partie qui change de table garde ses inscriptions', () => {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    convention.moveGame('brumes', 's1', 't3');

    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });

  it('deux parties échangées entre deux créneaux perdent leurs inscriptions', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'neons', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);

    convention.swapGames('brumes', 'neons');

    expect(signUpsOf(convention)).toEqual(['p1 epice']);
  });

  it('deux parties échangées sur un même créneau gardent leurs inscriptions', () => {
    const convention = aConvention();
    convention.unscheduleGame('neons');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);

    convention.swapGames('brumes', 'epice');

    expect(signUpsOf(convention)).toEqual(['p1 brumes', 'p2 epice']);
  });
});

describe('Inscriptions retirées par un geste (IN-6)', () => {
  /** Les inscriptions retirées par le geste de la case, dans les verdicts de déplacement. */
  const removedOnMoveTo = (
    convention: Convention,
    gameId: string,
    timeSlotId: string,
    tableId: string,
  ) =>
    convention
      .computeMoveVerdicts(gameId)
      .find((verdict) => verdict.timeSlotId === timeSlotId && verdict.tableId === tableId)!
      .removedSignUps;

  it('déplacer sur un autre créneau retire les inscriptions de la partie, avec ses inscrits sans autre inscription sur le créneau', () => {
    const convention = aConvention();
    convention.addTimeSlot('s3', at('18:00'), at('20:30'));
    convention.declareGameMasterAvailability('g1', 's3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);

    expect(removedOnMoveTo(convention, 'brumes', 's3', 't1')).toEqual([
      { gameId: 'brumes', signUpCount: 2, withoutOtherSignUpCount: 1 },
    ]);
  });

  it('changer de table ne retire rien', () => {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    expect(removedOnMoveTo(convention, 'brumes', 's1', 't3')).toEqual([]);
  });

  it('une case refusée, ou une partie sans inscrit, ne retire rien', () => {
    const convention = aConvention();
    convention.addTimeSlot('s3', at('18:00'), at('20:30'));
    convention.declareGameMasterAvailability('g1', 's3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    expect(removedOnMoveTo(convention, 'brumes', 's2', 't2')).toEqual([]);
    expect(removedOnMoveTo(convention, 'neons', 's3', 't1')).toEqual([]);
  });

  it('échanger entre deux créneaux retire les inscriptions des deux parties, dans l’ordre du programme', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'neons', CATALOGUE);
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);

    expect(removedOnMoveTo(convention, 'brumes', 's2', 't1')).toEqual([
      { gameId: 'brumes', signUpCount: 2, withoutOtherSignUpCount: 1 },
      { gameId: 'neons', signUpCount: 1, withoutOtherSignUpCount: 1 },
    ]);
  });

  it('échanger sur un même créneau ne retire rien', () => {
    const convention = aConvention();
    convention.unscheduleGame('neons');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);

    expect(removedOnMoveTo(convention, 'brumes', 's1', 't2')).toEqual([]);
  });

  it('déprogrammer retire les inscriptions de la partie', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);

    expect(convention.computeUnscheduleVerdict('epice')).toEqual({
      removedSignUps: [{ gameId: 'epice', signUpCount: 2, withoutOtherSignUpCount: 1 }],
      erasedDrawTimeSlotId: null,
    });
    expect(convention.computeUnscheduleVerdict('neons')).toEqual({
      removedSignUps: [],
      erasedDrawTimeSlotId: null,
    });
  });

  it('les inscriptions d’un MJ qui mène sur le créneau ne comptent pas (IN-4)', () => {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.addGameMaster('g3', 'p-g3', 'Mira');
    convention.declareGameMasterAvailability('g3', 's2');
    convention.signUpForGame('p-g3', 'epice', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's2', 't3');

    expect(convention.computeUnscheduleVerdict('epice')).toEqual({
      removedSignUps: [{ gameId: 'epice', signUpCount: 1, withoutOtherSignUpCount: 1 }],
      erasedDrawTimeSlotId: null,
    });
    convention.addTimeSlot('s3', at('18:00'), at('20:30'));
    convention.declareGameMasterAvailability('g2', 's3');
    expect(removedOnMoveTo(convention, 'epice', 's2', 't2')).toEqual([
      { gameId: 'epice', signUpCount: 1, withoutOtherSignUpCount: 1 },
    ]);
  });

  it('le geste retire les inscriptions présentes à l’écriture, même prises après le verdict', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.computeUnscheduleVerdict('epice');
    convention.signUpForGame('p2', 'epice', CATALOGUE);

    convention.unscheduleGame('epice');

    expect(signUpsOf(convention)).toEqual([]);
  });

  it('refuse le verdict de déprogrammation d’une partie inconnue', () => {
    expect(refusalOf(() => aConvention().computeUnscheduleVerdict('x')).code).toBe(
      'game-not-found',
    );
  });
});

describe('Un MJ qui mène sur un créneau où il est inscrit (IN-4)', () => {
  /**
   * « Mira » (g3, p-g3), disponible sur les deux créneaux, inscrite comme joueuse à « brumes »
   * (créneau 1) et à « néons » (créneau 2). Son scénario « ombres » n'est pas encore programmé.
   */
  function aConventionWithMira(): Convention {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.addGameMaster('g3', 'p-g3', 'Mira');
    convention.declareGameMasterAvailability('g3', 's1');
    convention.declareGameMasterAvailability('g3', 's2');
    convention.signUpForGame('p-g3', 'brumes', CATALOGUE);
    convention.signUpForGame('p-g3', 'neons', CATALOGUE);
    return convention;
  }
  const signedUpGameIdsOfMira = (convention: Convention) =>
    convention.computeParticipantSituation('p-g3', NOW).signedUpGameIds;

  it('garde ses inscriptions sur le créneau de sa partie, que sa situation montre en secours', () => {
    const convention = aConventionWithMira();

    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's1', 't3');

    expect(signUpsOf(convention)).toEqual(['p-g3 brumes', 'p-g3 neons']);
    expect(signedUpGameIdsOfMira(convention)).toEqual(['neons']);
    expect(convention.computeParticipantSituation('p-g3', NOW).backupGameIds).toEqual(['brumes']);
  });

  it('les lui rend quand sa partie quitte le créneau, et suspend celles du nouveau', () => {
    const convention = aConventionWithMira();
    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's1', 't3');

    convention.moveGame('ombres', 's2', 't3');

    expect(signUpsOf(convention)).toEqual(['p-g3 brumes', 'p-g3 neons']);
    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes']);
  });

  it('les lui rend toutes quand sa partie est déprogrammée', () => {
    const convention = aConventionWithMira();
    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's1', 't3');

    convention.unscheduleGame('ombres');

    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes', 'neons']);
  });

  it('les lui rend quand sa partie est échangée avec une partie d’un autre créneau', () => {
    const convention = aConventionWithMira();
    convention.addTimeSlot('s3', at('18:00'), at('20:30'));
    convention.declareGameMasterAvailability('g3', 's3');
    convention.addGameMaster('g4', 'p-g4', 'Sven');
    convention.declareGameMasterAvailability('g4', 's1');
    convention.declareGameMasterAvailability('g4', 's3');
    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's1', 't3');
    convention.scheduleScenario('lanternes', aScenario('e', 'g4'), 's3', 't3');

    convention.swapGames('ombres', 'lanternes');

    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes', 'neons']);
  });

  it('suspend son inscription à une partie double dont l’un des créneaux est celui de sa partie', () => {
    const convention = aConventionWithMira();
    convention.signUpForGame('p-g3', 'epice', CATALOGUE);

    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's2', 't3');

    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes']);
  });
});

describe('Un MJ qui s’inscrit sur un créneau où il mène (IN-4)', () => {
  it('est refusé sur sa propre partie', () => {
    const refusal = refusalOf(() => aConvention().signUpForGame('p-g2', 'epice', CATALOGUE));

    expect(refusal.code).toBe('game-led-by-participant');
  });

  it('s’inscrit en secours à une autre partie du créneau de sa partie, sans compter', () => {
    const convention = aConvention();

    convention.signUpForGame('p-g2', 'brumes', CATALOGUE);

    expect(signUpsOf(convention)).toEqual(['p-g2 brumes']);
    expect(convention.computeParticipantSituation('p-g2', NOW)).toMatchObject({
      signedUpGameIds: [],
      backupGameIds: ['brumes'],
    });
  });

  it('s’inscrit en secours sur le second créneau d’une partie double qu’il mène', () => {
    const convention = aConvention();

    convention.signUpForGame('p-g2', 'neons', CATALOGUE);

    expect(convention.computeParticipantSituation('p-g2', NOW)).toMatchObject({
      signedUpGameIds: [],
      backupGameIds: ['neons'],
    });
  });

  it('s’inscrit en secours à une partie double dont il mène le second créneau', () => {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.addGameMaster('g3', 'p-g3', 'Mira');
    convention.declareGameMasterAvailability('g3', 's2');
    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's2', 't3');

    convention.signUpForGame('p-g3', 'epice', CATALOGUE);

    expect(convention.computeParticipantSituation('p-g3', NOW)).toMatchObject({
      signedUpGameIds: [],
      backupGameIds: ['epice'],
    });
  });

  it('s’inscrit sur un créneau où il ne mène pas', () => {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.addGameMaster('g3', 'p-g3', 'Mira');
    convention.declareGameMasterAvailability('g3', 's2');
    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's2', 't3');

    convention.signUpForGame('p-g3', 'brumes', CATALOGUE);

    expect(signUpsOf(convention)).toEqual(['p-g3 brumes']);
    expect(convention.computeParticipantSituation('p-g3', NOW)).toMatchObject({
      signedUpGameIds: ['brumes'],
      backupGameIds: [],
    });
  });
});

describe('Supprimer un MJ (PR-12)', () => {
  it('efface ses inscriptions, et elles seules', () => {
    const convention = aConvention();
    convention.addGameMaster('g3', 'p-g3', 'Mira');
    convention.signUpForGame('p-g3', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    convention.removeGameMaster('g3', ScenarioCatalogue.restore([]), OTHER_ORGANIZER, NO_ACCOUNTS);

    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });
});

/** Les créneaux où le participant est sans partie, d'après sa situation. */
const timeSlotsWithoutGameOf = (convention: Convention, participantId: string) =>
  convention
    .computeParticipantSituation(participantId, NOW)
    .timeSlots.filter(({ withoutGame }) => withoutGame)
    .map(({ timeSlotId }) => timeSlotId);

/** Ajoute Mira (g3, p-g3), disponible sur les deux créneaux, et la table t3. */
function addMira(convention: Convention): void {
  convention.addTable('t3', 'Table 3');
  convention.addGameMaster('g3', 'p-g3', 'Mira');
  convention.declareGameMasterAvailability('g3', 's1');
  convention.declareGameMasterAvailability('g3', 's2');
}

describe('Devenir participant sans partie (IN-6)', () => {
  it('le devient sur le créneau quand sa dernière partie y est déprogrammée', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    convention.unscheduleGame('brumes');

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual(['s1']);
  });

  it('ne le devient pas s’il garde une autre inscription active sur le créneau', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'epice', CATALOGUE);

    convention.unscheduleGame('brumes');

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual([]);
  });

  it('le devient sur l’ancien créneau d’une partie déplacée', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.unscheduleGame('neons');

    convention.moveGame('brumes', 's2', 't1');

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual(['s1']);
  });

  it('le devient sur l’ancien créneau de chacune de deux parties échangées', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'neons', CATALOGUE);

    convention.swapGames('brumes', 'neons');

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual(['s1']);
    expect(timeSlotsWithoutGameOf(convention, 'p2')).toEqual(['s2']);
  });

  it('ne le devient pas quand sa partie change de table', () => {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    convention.moveGame('brumes', 's1', 't3');

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual([]);
  });

  it('le devient sur le seul premier créneau d’une partie double', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);

    convention.unscheduleGame('epice');

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual(['s1']);
  });

  it('un MJ qui mène sur le créneau ne le devient pas (IN-4)', () => {
    const convention = aConvention();
    addMira(convention);
    convention.signUpForGame('p-g3', 'neons', CATALOGUE);
    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's2', 't3');

    convention.unscheduleGame('neons');
    convention.unscheduleGame('ombres');

    expect(timeSlotsWithoutGameOf(convention, 'p-g3')).toEqual([]);
  });

  it('l’état est ignoré tant que son MJ mène sur le créneau (IN-4)', () => {
    const convention = aConvention();
    addMira(convention);
    convention.signUpForGame('p-g3', 'neons', CATALOGUE);
    convention.unscheduleGame('neons');

    convention.scheduleScenario('ombres', aScenario('d', 'g3'), 's2', 't3');
    const whileLeading = timeSlotsWithoutGameOf(convention, 'p-g3');
    convention.unscheduleGame('ombres');

    expect(whileLeading).toEqual([]);
    expect(timeSlotsWithoutGameOf(convention, 'p-g3')).toEqual(['s2']);
  });
});

describe('Cesser d’être participant sans partie', () => {
  /** Élodie (p1) est sans partie sur le créneau 1. */
  function aConventionWithoutGameForElodie(): Convention {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.unscheduleGame('brumes');
    return convention;
  }

  it('en s’inscrivant à une partie du créneau', () => {
    const convention = aConventionWithoutGameForElodie();

    convention.signUpForGame('p1', 'epice', CATALOGUE);

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual([]);
  });

  it('pas en s’inscrivant à une partie d’un autre créneau', () => {
    const convention = aConventionWithoutGameForElodie();

    convention.signUpForGame('p1', 'neons', CATALOGUE);

    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual(['s1']);
  });

  it('en se retirant du tirage du créneau', () => {
    const convention = aConventionWithoutGameForElodie();

    const changed = convention.withdrawFromDraw('p1', 's1');

    expect(changed).toBe(true);
    expect(timeSlotsWithoutGameOf(convention, 'p1')).toEqual([]);
  });

  it('se retirer du tirage sans être sans partie ne change rien', () => {
    const convention = aConventionWithoutGameForElodie();
    convention.withdrawFromDraw('p1', 's1');

    expect(convention.withdrawFromDraw('p1', 's1')).toBe(false);
    expect(convention.withdrawFromDraw('p2', 's1')).toBe(false);
  });

  it('se retirer du tirage refuse un créneau ou un participant introuvable', () => {
    const convention = aConventionWithoutGameForElodie();

    expect(refusalOf(() => convention.withdrawFromDraw('p1', 'inconnu')).code).toBe(
      'time-slot-not-found',
    );
    expect(refusalOf(() => convention.withdrawFromDraw('inconnu', 's1')).code).toBe(
      'participant-not-found',
    );
  });

  it('supprimer son MJ efface l’état (PR-12)', () => {
    const convention = aConvention();
    addMira(convention);
    convention.signUpForGame('p-g3', 'neons', CATALOGUE);
    convention.unscheduleGame('neons');

    convention.removeGameMaster('g3', ScenarioCatalogue.restore([]), OTHER_ORGANIZER, NO_ACCOUNTS);

    expect(convention.participantsWithoutGame).toEqual([]);
  });

  it('supprimer le créneau efface l’état (PR-10)', () => {
    const convention = aConvention();
    convention.addTimeSlot('s3', at('17:00'), at('19:00'));
    convention.declareGameMasterAvailability('g1', 's3');
    convention.scheduleScenario('aube', aScenario('a', 'g1'), 's3', 't1');
    convention.signUpForGame('p1', 'aube', CATALOGUE);
    convention.unscheduleGame('aube');

    convention.removeTimeSlot('s3');

    expect(convention.participantsWithoutGame).toEqual([]);
  });
});

describe('Situation d’un participant', () => {
  it('donne ses inscriptions, et chaque créneau aux inscriptions ouvertes, sans résultat de tirage', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'epice', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);

    expect(convention.computeParticipantSituation('p1', NOW)).toEqual({
      signedUpGameIds: ['epice'],
      backupGameIds: [],
      timeSlots: [
        {
          timeSlotId: 's1',
          state: 'sign-ups-open',
          ledGameId: null,
          drawResult: null,
          withoutGame: false,
        },
        {
          timeSlotId: 's2',
          state: 'sign-ups-open',
          ledGameId: null,
          drawResult: null,
          withoutGame: false,
        },
      ],
    });
  });

  it('donne à un MJ la partie qu’il mène sur chaque créneau, partie double comprise (IN-4)', () => {
    const convention = aConvention();

    expect(
      convention
        .computeParticipantSituation('p-g2', NOW)
        .timeSlots.map(({ ledGameId }) => ledGameId),
    ).toEqual(['epice', 'epice']);
    expect(
      convention
        .computeParticipantSituation('p-g1', NOW)
        .timeSlots.map(({ ledGameId }) => ledGameId),
    ).toEqual(['brumes', 'neons']);
  });

  it('refuse un participant introuvable', () => {
    expect(refusalOf(() => aConvention().computeParticipantSituation('inconnu', NOW)).code).toBe(
      'participant-not-found',
    );
  });
});
