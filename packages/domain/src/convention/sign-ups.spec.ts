import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { Convention } from './convention.js';
import type { LocalMoment } from './local-moment.js';
import { PresenceCode } from './presence-code.js';
import { TimeOfDay } from './time-of-day.js';

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
    games: [],
    version: 0,
    presenceCode: PresenceCode.of('K7M2'),
  });
  convention.addTimeSlot('s1', at('09:00'), at('11:30'));
  convention.addTimeSlot('s2', at('14:00'), at('16:30'));
  convention.addTable('t1', 'Table 1');
  convention.addTable('t2', 'Table 2');
  convention.addGameMaster('g1', 'p-g1', 'Brann');
  convention.addGameMaster('g2', 'p-g2', 'Kaïros');
  convention.declareAvailability('g1', 's1');
  convention.declareAvailability('g1', 's2');
  convention.declareAvailability('g2', 's1');
  convention.declareAvailability('g2', 's2');
  convention.schedule('brumes', aScenario('a', 'g1'), 's1', 't1');
  convention.schedule('epice', aScenario('b', 'g2', 2), 's1', 't2');
  convention.schedule('neons', aScenario('c', 'g1'), 's2', 't1');
  convention.identify('p1', 'K7M2', 'Élodie', null, NOW);
  convention.identify('p2', 'K7M2', 'Lune', null, NOW);
  return convention;
}

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

    const changed = convention.signUp('p1', 'brumes');

    expect(changed).toBe(true);
    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });

  it('inscrit à plusieurs parties d’un même créneau', () => {
    const convention = aConvention();

    convention.signUp('p1', 'brumes');
    convention.signUp('p1', 'epice');

    expect(signUpsOf(convention)).toEqual(['p1 brumes', 'p1 epice']);
  });

  it('ne change rien à une inscription répétée', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');

    const changed = convention.signUp('p1', 'brumes');

    expect(changed).toBe(false);
    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });

  it('refuse une partie introuvable', () => {
    expect(refusalOf(() => aConvention().signUp('p1', 'inconnue')).code).toBe('game-not-found');
  });

  it('refuse un participant introuvable', () => {
    expect(refusalOf(() => aConvention().signUp('inconnu', 'brumes')).code).toBe(
      'participant-not-found',
    );
  });

  it('garde les inscriptions prises sur le second créneau d’une partie double (IN-3)', () => {
    const convention = aConvention();
    convention.signUp('p1', 'neons');

    convention.signUp('p1', 'epice');

    expect(signUpsOf(convention)).toEqual(['p1 neons', 'p1 epice']);
  });
});

describe('Se désinscrire d’une partie (IN-2)', () => {
  it('retire l’inscription du participant, et elle seule', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');
    convention.signUp('p1', 'epice');
    convention.signUp('p2', 'brumes');

    const changed = convention.withdraw('p1', 'brumes');

    expect(changed).toBe(true);
    expect(signUpsOf(convention)).toEqual(['p1 epice', 'p2 brumes']);
  });

  it('ne change rien pour une partie où le participant n’est pas inscrit', () => {
    const convention = aConvention();

    const changed = convention.withdraw('p1', 'brumes');

    expect(changed).toBe(false);
    expect(signUpsOf(convention)).toEqual([]);
  });

  it('refuse une partie introuvable', () => {
    expect(refusalOf(() => aConvention().withdraw('p1', 'inconnue')).code).toBe('game-not-found');
  });

  it('refuse un participant introuvable', () => {
    expect(refusalOf(() => aConvention().withdraw('inconnu', 'brumes')).code).toBe(
      'participant-not-found',
    );
  });
});

describe('Gestes de programmation et inscriptions (IN-6)', () => {
  it('une partie déprogrammée perd ses inscriptions, et elles seules', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');
    convention.signUp('p1', 'epice');
    convention.signUp('p2', 'brumes');

    convention.unschedule('brumes');

    expect(signUpsOf(convention)).toEqual(['p1 epice']);
  });

  it('une partie déplacée sur un autre créneau perd ses inscriptions', () => {
    const convention = aConvention();
    convention.addTimeSlot('s3', at('18:00'), at('20:30'));
    convention.declareAvailability('g1', 's3');
    convention.signUp('p1', 'brumes');
    convention.signUp('p1', 'epice');

    convention.moveGame('brumes', 's3', 't1');

    expect(signUpsOf(convention)).toEqual(['p1 epice']);
  });

  it('une partie qui change de table garde ses inscriptions', () => {
    const convention = aConvention();
    convention.addTable('t3', 'Table 3');
    convention.signUp('p1', 'brumes');

    convention.moveGame('brumes', 's1', 't3');

    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });

  it('deux parties échangées entre deux créneaux perdent leurs inscriptions', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');
    convention.signUp('p1', 'neons');
    convention.signUp('p1', 'epice');

    convention.swapGames('brumes', 'neons');

    expect(signUpsOf(convention)).toEqual(['p1 epice']);
  });

  it('deux parties échangées sur un même créneau gardent leurs inscriptions', () => {
    const convention = aConvention();
    convention.unschedule('neons');
    convention.signUp('p1', 'brumes');
    convention.signUp('p2', 'epice');

    convention.swapGames('brumes', 'epice');

    expect(signUpsOf(convention)).toEqual(['p1 brumes', 'p2 epice']);
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
    convention.declareAvailability('g3', 's1');
    convention.declareAvailability('g3', 's2');
    convention.signUp('p-g3', 'brumes');
    convention.signUp('p-g3', 'neons');
    return convention;
  }
  const signedUpGameIdsOfMira = (convention: Convention) =>
    convention.situationOf('p-g3').signedUpGameIds;

  it('garde ses inscriptions sur le créneau de sa partie, sans les montrer dans sa situation', () => {
    const convention = aConventionWithMira();

    convention.schedule('ombres', aScenario('d', 'g3'), 's1', 't3');

    expect(signUpsOf(convention)).toEqual(['p-g3 brumes', 'p-g3 neons']);
    expect(signedUpGameIdsOfMira(convention)).toEqual(['neons']);
  });

  it('les lui rend quand sa partie quitte le créneau, et suspend celles du nouveau', () => {
    const convention = aConventionWithMira();
    convention.schedule('ombres', aScenario('d', 'g3'), 's1', 't3');

    convention.moveGame('ombres', 's2', 't3');

    expect(signUpsOf(convention)).toEqual(['p-g3 brumes', 'p-g3 neons']);
    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes']);
  });

  it('les lui rend toutes quand sa partie est déprogrammée', () => {
    const convention = aConventionWithMira();
    convention.schedule('ombres', aScenario('d', 'g3'), 's1', 't3');

    convention.unschedule('ombres');

    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes', 'neons']);
  });

  it('les lui rend quand sa partie est échangée avec une partie d’un autre créneau', () => {
    const convention = aConventionWithMira();
    convention.addTimeSlot('s3', at('18:00'), at('20:30'));
    convention.declareAvailability('g3', 's3');
    convention.addGameMaster('g4', 'p-g4', 'Sven');
    convention.declareAvailability('g4', 's1');
    convention.declareAvailability('g4', 's3');
    convention.schedule('ombres', aScenario('d', 'g3'), 's1', 't3');
    convention.schedule('lanternes', aScenario('e', 'g4'), 's3', 't3');

    convention.swapGames('ombres', 'lanternes');

    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes', 'neons']);
  });

  it('suspend son inscription à une partie double dont l’un des créneaux est celui de sa partie', () => {
    const convention = aConventionWithMira();
    convention.signUp('p-g3', 'epice');

    convention.schedule('ombres', aScenario('d', 'g3'), 's2', 't3');

    expect(signedUpGameIdsOfMira(convention)).toEqual(['brumes']);
  });
});

describe('Supprimer un MJ (PR-12)', () => {
  it('efface ses inscriptions, et elles seules', () => {
    const convention = aConvention();
    convention.addGameMaster('g3', 'p-g3', 'Mira');
    convention.signUp('p-g3', 'brumes');
    convention.signUp('p1', 'brumes');

    convention.removeGameMaster('g3', ScenarioCatalogue.restore([]));

    expect(signUpsOf(convention)).toEqual(['p1 brumes']);
  });
});

describe('Situation d’un participant', () => {
  it('donne ses inscriptions, et chaque créneau aux inscriptions ouvertes, sans résultat de tirage', () => {
    const convention = aConvention();
    convention.signUp('p1', 'epice');
    convention.signUp('p2', 'brumes');

    expect(convention.situationOf('p1')).toEqual({
      signedUpGameIds: ['epice'],
      timeSlots: [
        { timeSlotId: 's1', state: 'sign-ups-open', drawResult: null },
        { timeSlotId: 's2', state: 'sign-ups-open', drawResult: null },
      ],
    });
  });

  it('refuse un participant introuvable', () => {
    expect(refusalOf(() => aConvention().situationOf('inconnu')).code).toBe(
      'participant-not-found',
    );
  });
});
