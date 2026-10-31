import { describe, expect, it } from 'vitest';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { Convention } from './convention.js';
import type { LocalMoment } from './local-moment.js';
import { PresenceCode } from './presence-code.js';
import { SignUp } from './sign-up.js';
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
 * Le 14 mars 2027, créneaux s1 (9 h – 11 h 30), s2 (14 h – 16 h 30) et s3 (18 h – 20 h 30), tables
 * t1, t2 et t3. Au créneau 1 : « brumes » de Brann (scénario a, t1) et « épice » de Kaïros, partie
 * double des créneaux 1 et 2 (scénario b, t2). Au créneau 2 : « néons » de Brann (scénario c, t1).
 * Les participants « Élodie » (p1) et « Lune » (p2) se sont identifiés.
 */
function aConvention(date: string | null = '2027-03-14'): Convention {
  const convention = Convention.restore({
    id: 'c1',
    name: 'Histoires de Chimères',
    date,
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
  convention.addTimeSlot('s3', at('18:00'), at('20:30'));
  convention.addTable('t1', 'Table 1');
  convention.addTable('t2', 'Table 2');
  convention.addTable('t3', 'Table 3');
  convention.addGameMaster('g1', 'p-g1', 'Brann');
  convention.addGameMaster('g2', 'p-g2', 'Kaïros');
  for (const gameMasterId of ['g1', 'g2']) {
    for (const timeSlotId of ['s1', 's2', 's3']) {
      convention.declareAvailability(gameMasterId, timeSlotId);
    }
  }
  convention.schedule('brumes', aScenario('a', 'g1'), 's1', 't1');
  convention.schedule('epice', aScenario('b', 'g2', 2), 's1', 't2');
  convention.schedule('neons', aScenario('c', 'g1'), 's2', 't1');
  convention.identify('p1', 'K7M2', 'Élodie', null, NOW);
  convention.identify('p2', 'K7M2', 'Lune', null, NOW);
  return convention;
}

const endOfDay = (time: string): LocalMoment => ({ date: '2027-03-14', time: at(time) });

/**
 * La convention, avec en plus des inscriptions d'un MJ prises avant la programmation de ses
 * parties : elles restent, sans compter (IN-4), alors que `signUp()` les refuserait aujourd'hui.
 */
function withGameMasterSignUps(convention: Convention, ...signUps: SignUp[]): Convention {
  return Convention.restore({
    id: convention.id,
    name: convention.name,
    date: convention.date,
    timeSlots: [...convention.timeSlots],
    tables: [...convention.tables],
    gameMasters: [...convention.gameMasters],
    participants: [...convention.participants],
    signUps: [...convention.signUps, ...signUps],
    games: [...convention.games],
    version: convention.version,
    presenceCode: convention.presenceCode,
  });
}

describe('Notifications d’une partie déprogrammée (NO-2)', () => {
  it('préviennent ses inscrits, et son MJ avec un autre code, jusqu’à la fin de son créneau', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');
    convention.signUp('p2', 'brumes');
    convention.signUp('p2', 'neons');

    const notifications = convention.unschedule('brumes');

    expect(notifications).toEqual([
      {
        code: 'game-unscheduled',
        params: { scenarioId: 'a', ranks: [1] },
        recipients: { kind: 'participants', participantIds: ['p1', 'p2'] },
        deadline: endOfDay('11:30'),
      },
      {
        code: 'own-game-unscheduled',
        params: { scenarioId: 'a', ranks: [1] },
        recipients: { kind: 'participants', participantIds: ['p-g1'] },
        deadline: endOfDay('11:30'),
      },
    ]);
  });

  it('une partie double se désigne par ses deux créneaux, et court jusqu’à la fin du second', () => {
    const convention = aConvention();
    convention.signUp('p1', 'epice');

    const [toSignedUp] = convention.unschedule('epice');

    expect(toSignedUp?.params).toEqual({ scenarioId: 'b', ranks: [1, 2] });
    expect(toSignedUp?.deadline).toEqual(endOfDay('16:30'));
  });

  it('sans inscrit, seul le MJ est prévenu', () => {
    expect(
      aConvention()
        .unschedule('brumes')
        .map(({ code }) => code),
    ).toEqual(['own-game-unscheduled']);
  });

  it('n’ont pas d’échéance tant que la convention n’a pas de date', () => {
    const convention = aConvention(null);

    expect(convention.unschedule('brumes').map(({ deadline }) => deadline)).toEqual([null]);
  });

  it('le MJ ne reçoit que la sienne, même inscrit à sa partie : la plus précise (NO-1)', () => {
    const convention = withGameMasterSignUps(aConvention(), new SignUp('p-g1', 'brumes'));
    convention.signUp('p1', 'brumes');

    const notifications = convention.unschedule('brumes');

    expect(notifications.map(({ recipients }) => recipients)).toEqual([
      { kind: 'participants', participantIds: ['p1'] },
      { kind: 'participants', participantIds: ['p-g1'] },
    ]);
  });
});

describe('Notifications d’une partie déplacée (NO-2)', () => {
  it('préviennent ses inscrits quand elle passe à un autre créneau, jusqu’à la fin du plus tardif', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');
    convention.signUp('p2', 'neons');

    const notifications = convention.moveGame('brumes', 's3', 't2');

    expect(notifications).toEqual([
      {
        code: 'game-moved',
        params: { gameId: 'brumes', scenarioId: 'a', fromRanks: [1], toRanks: [3] },
        recipients: { kind: 'participants', participantIds: ['p1'] },
        deadline: endOfDay('20:30'),
      },
    ]);
  });

  it('courent jusqu’à la fin de son ancien créneau quand elle avance', () => {
    const convention = aConvention();
    convention.unschedule('brumes');
    convention.signUp('p1', 'neons');

    const [moved] = convention.moveGame('neons', 's1', 't3');

    expect(moved?.params).toEqual({
      gameId: 'neons',
      scenarioId: 'c',
      fromRanks: [2],
      toRanks: [1],
    });
    expect(moved?.deadline).toEqual(endOfDay('16:30'));
  });

  it('ne partent pas quand elle change seulement de table (NO-4)', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');

    expect(convention.moveGame('brumes', 's1', 't3')).toEqual([]);
  });

  it('ne partent pas sans inscrit', () => {
    expect(aConvention().moveGame('brumes', 's3', 't1')).toEqual([]);
  });

  it('ne vont pas à une inscription qui ne compte pas (IN-4)', () => {
    const convention = withGameMasterSignUps(aConvention(), new SignUp('p-g1', 'epice'));

    expect(convention.moveGame('epice', 's2', 't2')).toEqual([]);
  });
});

describe('Notifications de deux parties échangées (NO-2)', () => {
  it('préviennent les inscrits de chacune, une notification par partie', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');
    convention.signUp('p1', 'neons');
    convention.signUp('p2', 'neons');

    const notifications = convention.swapGames('brumes', 'neons');

    expect(
      notifications.map(({ code, params, recipients }) => ({ code, params, recipients })),
    ).toEqual([
      {
        code: 'game-moved',
        params: { gameId: 'brumes', scenarioId: 'a', fromRanks: [1], toRanks: [2] },
        recipients: { kind: 'participants', participantIds: ['p1'] },
      },
      {
        code: 'game-moved',
        params: { gameId: 'neons', scenarioId: 'c', fromRanks: [2], toRanks: [1] },
        recipients: { kind: 'participants', participantIds: ['p1', 'p2'] },
      },
    ]);
  });

  it('ne partent pas pour deux parties d’un même créneau (NO-4)', () => {
    const convention = aConvention();
    convention.signUp('p1', 'brumes');
    convention.signUp('p2', 'epice');
    convention.unschedule('neons');

    expect(convention.swapGames('brumes', 'epice')).toEqual([]);
  });
});
