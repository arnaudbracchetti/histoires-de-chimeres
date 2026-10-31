import { describe, expect, it } from 'vitest';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import type { Notification, NotificationCode } from '../notification.js';
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
    presenceCode: PresenceCode.parse('K7M2'),
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
      convention.declareGameMasterAvailability(gameMasterId, timeSlotId);
    }
  }
  convention.scheduleScenario('brumes', aScenario('a', 'g1'), 's1', 't1');
  convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
  convention.scheduleScenario('neons', aScenario('c', 'g1'), 's2', 't1');
  convention.identifyByNickname('p1', 'K7M2', 'Élodie', null, NOW);
  convention.identifyByNickname('p2', 'K7M2', 'Lune', null, NOW);
  return convention;
}

/** Les scénarios a, b et c, à 5 places maximum. */
const CATALOGUE = ScenarioCatalogue.restore([
  { id: 'a', gameMasterId: 'g1', duration: 1, maxSeats: 5 },
  { id: 'b', gameMasterId: 'g2', duration: 2, maxSeats: 5 },
  { id: 'c', gameMasterId: 'g1', duration: 1, maxSeats: 5 },
]);

const endOfDay = (time: string): LocalMoment => ({ date: '2027-03-14', time: at(time) });

/**
 * La convention, avec en plus des inscriptions d'un MJ prises avant la programmation de ses
 * parties : elles restent, sans compter (IN-4), alors que `signUpForGame()` les refuserait aujourd'hui.
 */
function restoreWithGameMasterSignUps(convention: Convention, ...signUps: SignUp[]): Convention {
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

/** La convention, avec Sven (g3, p-g3), MJ disponible sur les trois créneaux, sans partie. */
function addSvenAvailableEverywhere(convention: Convention): Convention {
  convention.addGameMaster('g3', 'p-g3', 'Sven');
  for (const timeSlotId of ['s1', 's2', 's3']) {
    convention.declareGameMasterAvailability('g3', timeSlotId);
  }
  return convention;
}

describe('Notifications d’une partie programmée (NO-2)', () => {
  it('préviennent tout le monde d’une nouvelle partie, sauf les MJ qui mènent sur le créneau, et son MJ qu’il la mène', () => {
    const convention = addSvenAvailableEverywhere(aConvention());

    const notifications = convention.scheduleScenario('songe', aScenario('d', 'g3'), 's2', 't3');

    expect(notifications).toEqual([
      {
        code: 'new-game',
        params: { gameId: 'songe', scenarioId: 'd', ranks: [2], tableName: 'Table 3' },
        recipients: { kind: 'everyone-except', participantIds: ['p-g1', 'p-g2', 'p-g3'] },
        deadline: endOfDay('16:30'),
      },
      {
        code: 'own-game-scheduled',
        params: {
          scenarioId: 'd',
          ranks: [2],
          tableName: 'Table 3',
          start: '14:00',
          end: '16:30',
        },
        recipients: { kind: 'participants', participantIds: ['p-g3'] },
        deadline: endOfDay('16:30'),
      },
    ]);
  });

  it('une partie double se désigne par ses deux créneaux, et écarte les MJ qui mènent sur le second', () => {
    const convention = addSvenAvailableEverywhere(aConvention());
    convention.unscheduleGame('epice');

    const [newGame, ownGame] = convention.scheduleScenario(
      'songe',
      aScenario('d', 'g3', 2),
      's2',
      't3',
    );

    expect(newGame).toMatchObject({
      params: { ranks: [2, 3] },
      recipients: { participantIds: ['p-g1', 'p-g3'] },
      deadline: endOfDay('20:30'),
    });
    expect(ownGame).toMatchObject({
      params: { ranks: [2, 3], start: '14:00', end: '20:30' },
      recipients: { participantIds: ['p-g3'] },
    });
  });

  it('gardent les inscriptions de son MJ sur le créneau, sans qu’elles comptent (IN-4)', () => {
    const convention = addSvenAvailableEverywhere(aConvention());
    convention.signUpForGame('p-g3', 'neons', CATALOGUE);

    convention.scheduleScenario('songe', aScenario('d', 'g3'), 's2', 't3');

    expect(convention.signUps.map(({ gameId }) => gameId)).toEqual(['neons']);
    expect(convention.computeParticipantSituation('p-g3').signedUpGameIds).toEqual([]);
  });
});

describe('Notifications d’une partie déprogrammée (NO-2)', () => {
  it('préviennent ses inscrits, et son MJ avec un autre code, jusqu’à la fin de son créneau', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'neons', CATALOGUE);

    const notifications = convention.unscheduleGame('brumes');

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
    convention.signUpForGame('p1', 'epice', CATALOGUE);

    const [toSignedUp] = convention.unscheduleGame('epice');

    expect(toSignedUp?.params).toEqual({ scenarioId: 'b', ranks: [1, 2] });
    expect(toSignedUp?.deadline).toEqual(endOfDay('16:30'));
  });

  it('sans inscrit, seul le MJ est prévenu', () => {
    expect(
      aConvention()
        .unscheduleGame('brumes')
        .map(({ code }) => code),
    ).toEqual(['own-game-unscheduled']);
  });

  it('n’ont pas d’échéance tant que la convention n’a pas de date', () => {
    const convention = aConvention(null);

    expect(convention.unscheduleGame('brumes').map(({ deadline }) => deadline)).toEqual([null]);
  });

  it('le MJ ne reçoit que la sienne, même inscrit à sa partie : la plus précise (NO-1)', () => {
    const convention = restoreWithGameMasterSignUps(aConvention(), new SignUp('p-g1', 'brumes'));
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    const notifications = convention.unscheduleGame('brumes');

    expect(notifications.map(({ recipients }) => recipients)).toEqual([
      { kind: 'participants', participantIds: ['p1'] },
      { kind: 'participants', participantIds: ['p-g1'] },
    ]);
  });
});

/** Les notifications de ce code. */
function filterByCode(notifications: readonly Notification[], code: NotificationCode) {
  return notifications.filter((notification) => notification.code === code);
}

describe('Notifications d’une partie déplacée (NO-2)', () => {
  it('préviennent ses inscrits quand elle passe à un autre créneau, jusqu’à la fin du plus tardif', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'neons', CATALOGUE);

    const notifications = convention.moveGame('brumes', 's3', 't2');

    expect(filterByCode(notifications, 'game-moved')).toEqual([
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
    convention.unscheduleGame('brumes');
    convention.signUpForGame('p1', 'neons', CATALOGUE);

    const [moved] = convention.moveGame('neons', 's1', 't3');

    expect(moved?.params).toEqual({
      gameId: 'neons',
      scenarioId: 'c',
      fromRanks: [2],
      toRanks: [1],
    });
    expect(moved?.deadline).toEqual(endOfDay('16:30'));
  });

  it('préviennent de la nouvelle partie tous ceux qui peuvent s’y inscrire, sauf ses inscrits, et son MJ qu’il la mène', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    const notifications = convention.moveGame('brumes', 's3', 't2');

    expect(notifications.map(({ code }) => code)).toEqual([
      'game-moved',
      'new-game',
      'own-game-scheduled',
    ]);
    expect(filterByCode(notifications, 'new-game')).toEqual([
      {
        code: 'new-game',
        params: { gameId: 'brumes', scenarioId: 'a', ranks: [3], tableName: 'Table 2' },
        recipients: { kind: 'everyone-except', participantIds: ['p-g1', 'p1'] },
        deadline: endOfDay('20:30'),
      },
    ]);
    expect(filterByCode(notifications, 'own-game-scheduled')).toEqual([
      {
        code: 'own-game-scheduled',
        params: {
          scenarioId: 'a',
          ranks: [3],
          tableName: 'Table 2',
          start: '18:00',
          end: '20:30',
        },
        recipients: { kind: 'participants', participantIds: ['p-g1'] },
        deadline: endOfDay('20:30'),
      },
    ]);
  });

  it('ne partent pas quand elle change seulement de table (NO-4)', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    expect(convention.moveGame('brumes', 's1', 't3')).toEqual([]);
  });

  it('sans inscrit, seules partent « nouvelle partie » et celle du MJ', () => {
    expect(
      aConvention()
        .moveGame('brumes', 's3', 't1')
        .map(({ code }) => code),
    ).toEqual(['new-game', 'own-game-scheduled']);
  });

  it('ne vont pas à une inscription qui ne compte pas (IN-4)', () => {
    const convention = restoreWithGameMasterSignUps(aConvention(), new SignUp('p-g1', 'epice'));

    expect(filterByCode(convention.moveGame('epice', 's2', 't2'), 'game-moved')).toEqual([]);
  });
});

describe('Notifications de deux parties échangées (NO-2)', () => {
  it('préviennent les inscrits de chacune, une notification par partie', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p1', 'neons', CATALOGUE);
    convention.signUpForGame('p2', 'neons', CATALOGUE);

    const notifications = convention.swapGames('brumes', 'neons');

    expect(
      filterByCode(notifications, 'game-moved').map(({ code, params, recipients }) => ({
        code,
        params,
        recipients,
      })),
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

  it('entre deux créneaux, une « nouvelle partie » et une « tu mènes une partie » par partie, sauf à ceux qui reçoivent plus précis (NO-1)', () => {
    const convention = addSvenAvailableEverywhere(aConvention());
    convention.scheduleScenario('songe', aScenario('d', 'g3'), 's3', 't3');
    convention.signUpForGame('p1', 'brumes', CATALOGUE);

    const notifications = convention.swapGames('brumes', 'songe');

    expect(
      notifications.map(({ code, params, recipients }) => ({
        code,
        ranks: 'ranks' in params ? params.ranks : null,
        recipients,
      })),
    ).toEqual([
      {
        code: 'game-moved',
        ranks: null,
        recipients: { kind: 'participants', participantIds: ['p1'] },
      },
      {
        code: 'new-game',
        ranks: [3],
        recipients: { kind: 'everyone-except', participantIds: ['p-g1', 'p1', 'p-g3'] },
      },
      {
        code: 'new-game',
        ranks: [1],
        recipients: { kind: 'everyone-except', participantIds: ['p-g2', 'p-g3', 'p1', 'p-g1'] },
      },
      {
        code: 'own-game-scheduled',
        ranks: [3],
        recipients: { kind: 'participants', participantIds: ['p-g1'] },
      },
      {
        code: 'own-game-scheduled',
        ranks: [1],
        recipients: { kind: 'participants', participantIds: ['p-g3'] },
      },
    ]);
  });

  it('ne partent pas pour deux parties d’un même créneau (NO-4)', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);
    convention.unscheduleGame('neons');

    expect(convention.swapGames('brumes', 'epice')).toEqual([]);
  });
});

/** Le catalogue, avec ces places maximum pour certains scénarios. */
function catalogueWithMaxSeats(maxSeats: Record<string, number>): ScenarioCatalogue {
  return ScenarioCatalogue.restore(
    CATALOGUE.listEntries().map((entry) => ({
      ...entry,
      maxSeats: maxSeats[entry.id] ?? entry.maxSeats,
    })),
  );
}

/** Identifie ces participants en plus, sous l'identifiant de leur pseudo. */
function identify(convention: Convention, ...nicknames: string[]): void {
  for (const nickname of nicknames)
    convention.identifyByNickname(nickname, 'K7M2', nickname, null, NOW);
}

describe('Notification d’une partie très demandée par une inscription (NO-2, IN-5)', () => {
  it('prévient ses inscrits, sauf l’auteur, quand elle passe au-dessus de ses places maximum', () => {
    const convention = aConvention();
    const catalogue = catalogueWithMaxSeats({ a: 2 });
    convention.signUpForGame('p1', 'brumes', catalogue);
    convention.signUpForGame('p2', 'brumes', catalogue);
    identify(convention, 'Zoé');

    const notifications = convention.signUpForGame('Zoé', 'brumes', catalogue);

    expect(notifications).toEqual([
      {
        code: 'game-oversubscribed',
        params: { scenarioId: 'a', rank: 1 },
        recipients: { kind: 'participants', participantIds: ['p1', 'p2'] },
        deadline: endOfDay('11:30'),
      },
    ]);
  });

  it('repart à chaque nouveau dépassement, même après une redescente', () => {
    const convention = aConvention();
    const catalogue = catalogueWithMaxSeats({ a: 1 });
    convention.signUpForGame('p1', 'brumes', catalogue);
    convention.signUpForGame('p2', 'brumes', catalogue);
    convention.withdrawFromGame('p2', 'brumes');

    const notifications = convention.signUpForGame('p2', 'brumes', catalogue);

    expect(notifications?.map(({ recipients }) => recipients.participantIds)).toEqual([['p1']]);
  });

  it('ne part pas tant que la partie reste sous ses places maximum, ni quand elle les a déjà dépassées', () => {
    const convention = aConvention();
    const catalogue = catalogueWithMaxSeats({ a: 1 });
    identify(convention, 'Zoé');

    expect(convention.signUpForGame('p1', 'brumes', catalogue)).toEqual([]);
    convention.signUpForGame('p2', 'brumes', catalogue);
    expect(convention.signUpForGame('Zoé', 'brumes', catalogue)).toEqual([]);
  });

  it('ne part pas pour une inscription répétée : rien ne change', () => {
    const convention = aConvention();
    const catalogue = catalogueWithMaxSeats({ a: 1 });
    convention.signUpForGame('p1', 'brumes', catalogue);
    convention.signUpForGame('p2', 'brumes', catalogue);

    expect(convention.signUpForGame('p2', 'brumes', catalogue)).toBeNull();
  });

  it('ne va pas à un inscrit qui a une autre inscription sur le créneau', () => {
    const convention = aConvention();
    const catalogue = catalogueWithMaxSeats({ a: 1 });
    convention.signUpForGame('p1', 'brumes', catalogue);
    convention.signUpForGame('p1', 'epice', catalogue);

    expect(convention.signUpForGame('p2', 'brumes', catalogue)).toEqual([]);
  });

  it('une partie double se désigne par son premier créneau, et compte les inscriptions qui y commencent', () => {
    const convention = aConvention();
    const catalogue = catalogueWithMaxSeats({ b: 1 });
    convention.signUpForGame('p1', 'epice', catalogue);
    convention.signUpForGame('p1', 'neons', catalogue);

    const [notification] = convention.signUpForGame('p2', 'epice', catalogue) ?? [];

    expect(notification).toMatchObject({
      params: { scenarioId: 'b', rank: 1 },
      recipients: { participantIds: ['p1'] },
      deadline: endOfDay('16:30'),
    });
  });

  it('une inscription à une partie double ne compte pas sur son second créneau', () => {
    const convention = aConvention();
    const catalogue = catalogueWithMaxSeats({ c: 1 });
    convention.signUpForGame('p1', 'neons', catalogue);
    convention.signUpForGame('p1', 'epice', catalogue);

    const notifications = convention.signUpForGame('p2', 'neons', catalogue);

    expect(notifications?.map(({ params }) => params)).toEqual([{ scenarioId: 'c', rank: 2 }]);
  });

  it('ne compte pas l’inscription d’un MJ sur un créneau où il mène, ni ne le prévient (IN-4)', () => {
    const convention = restoreWithGameMasterSignUps(aConvention(), new SignUp('p-g1', 'epice'));
    const catalogue = catalogueWithMaxSeats({ b: 1 });

    expect(convention.signUpForGame('p1', 'epice', catalogue)).toEqual([]);
    expect(
      convention
        .signUpForGame('p2', 'epice', catalogue)
        ?.map(({ recipients }) => recipients.participantIds),
    ).toEqual([['p1']]);
  });
});

describe('Notification d’une partie très demandée par une baisse des places (NO-2, PR-4)', () => {
  /** Le scénario a de « brumes », à ces places maximum. */
  const scenarioA = (max: number) => {
    const scenario = aScenario('a', 'g1');
    scenario.changeSeats({ min: 1, max });
    return scenario;
  };

  it('prévient tous ses inscrits sans autre inscription sur le créneau', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'epice', CATALOGUE);

    const notifications = convention.buildOversubscribedNotificationsAfterSeatsChange(
      scenarioA(1),
      scenarioA(5).seats,
    );

    expect(notifications).toEqual([
      {
        code: 'game-oversubscribed',
        params: { scenarioId: 'a', rank: 1 },
        recipients: { kind: 'participants', participantIds: ['p1'] },
        deadline: endOfDay('11:30'),
      },
    ]);
  });

  it('ne part pas pour une partie déjà au-dessus de ses places maximum, ni qui reste en dessous', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);

    expect(
      convention.buildOversubscribedNotificationsAfterSeatsChange(scenarioA(1), scenarioA(1).seats),
    ).toEqual([]);
    expect(
      convention.buildOversubscribedNotificationsAfterSeatsChange(scenarioA(2), scenarioA(5).seats),
    ).toEqual([]);
  });

  it('ne part pas quand les places montent', () => {
    const convention = aConvention();
    convention.signUpForGame('p1', 'brumes', CATALOGUE);
    convention.signUpForGame('p2', 'brumes', CATALOGUE);

    expect(
      convention.buildOversubscribedNotificationsAfterSeatsChange(scenarioA(5), scenarioA(1).seats),
    ).toEqual([]);
  });
});
