import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { ComparableName } from '../comparable-name.js';
import { Convention } from './convention.js';
import { Game } from './game.js';
import { GameMaster } from './game-master.js';
import { Seats } from '../scenario/seats.js';
import { Table } from './table.js';
import { TimeOfDay } from './time-of-day.js';
import { TimeSlot } from './time-slot.js';

const at = TimeOfDay.parse;

/**
 * Créneaux s1 (9 h – 11 h 30) et s2 (14 h – 16 h 30), tables t1 « Table 1 » et t2 « Table 2 ».
 * MJ g1 « Élodie », disponible sur s1 et s2 ; MJ g2 « Kaïros », disponible sur s1 seulement.
 */
function aConvention(): Convention {
  const convention = Convention.restore({
    id: 'c1',
    name: 'Histoires de Chimères',
    date: null,
    timeSlots: [],
    tables: [],
    gameMasters: [],
    games: [],
    version: 0,
  });
  convention.addTimeSlot('s1', at('09:00'), at('11:30'));
  convention.addTimeSlot('s2', at('14:00'), at('16:30'));
  convention.addTable('t1', 'Table 1');
  convention.addTable('t2', 'Table 2');
  convention.addGameMaster('g1', 'Élodie');
  convention.addGameMaster('g2', 'Kaïros');
  convention.declareAvailability('g1', 's1');
  convention.declareAvailability('g1', 's2');
  convention.declareAvailability('g2', 's1');
  return convention;
}

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

function refusalOf(action: () => void): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error("L'action n'a pas été refusée.");
}

const neons = aScenario('a', 'g1');
const ruines = aScenario('b', 'g1');
const brumes = aScenario('c', 'g2');

describe('Programmer une partie (PR-3)', () => {
  it('programme un scénario sur un créneau et une table', () => {
    const convention = aConvention();

    convention.schedule('p1', neons, 's1', 't1');

    expect(convention.games).toEqual([
      expect.objectContaining({
        id: 'p1',
        scenarioId: 'a',
        gameMasterId: 'g1',
        tableId: 't1',
        timeSlotIds: ['s1'],
        seats: null,
      }),
    ]);
  });

  it('programme plusieurs fois le même scénario', () => {
    const convention = aConvention();

    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', neons, 's2', 't1');

    expect(convention.games.map(({ id }) => id)).toEqual(['p1', 'p2']);
  });

  it('refuse un créneau ou une table inconnus', () => {
    const convention = aConvention();

    expect(refusalOf(() => convention.schedule('p1', neons, 'x', 't1')).code).toBe(
      'time-slot-not-found',
    );
    expect(refusalOf(() => convention.schedule('p1', neons, 's1', 'x')).code).toBe(
      'table-not-found',
    );
  });
});

describe('Contraintes de programmation (PR-5)', () => {
  it('refuse un créneau où le MJ est indisponible', () => {
    const refusal = refusalOf(() => aConvention().schedule('p1', brumes, 's2', 't1'));

    expect(refusal).toMatchObject({
      code: 'game-master-unavailable',
      params: { nickname: 'Kaïros', rank: 2 },
    });
  });

  it('refuse un MJ qui mène déjà une partie sur le créneau', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    const refusal = refusalOf(() => convention.schedule('p2', ruines, 's1', 't2'));

    expect(refusal).toMatchObject({
      code: 'game-master-busy',
      params: { nickname: 'Élodie', rank: 1 },
    });
  });

  it('refuse une table déjà prise sur le créneau', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    const refusal = refusalOf(() => convention.schedule('p2', brumes, 's1', 't1'));

    expect(refusal).toMatchObject({
      code: 'table-taken',
      params: { table: 'Table 1', rank: 1 },
    });
  });

  it('donne le MJ occupé avant la table prise', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', brumes, 's1', 't2');

    expect(refusalOf(() => convention.schedule('p3', ruines, 's1', 't2')).code).toBe(
      'game-master-busy',
    );
  });

  it("donne l'indisponibilité avant la table prise", () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's2', 't1');

    expect(refusalOf(() => convention.schedule('p2', brumes, 's2', 't1')).code).toBe(
      'game-master-unavailable',
    );
  });
});

describe('Programmer une partie double (PR-5, PR-8)', () => {
  const double = aScenario('d', 'g1', 2);

  /**
   * Créneaux s1 (9 h – 11 h 30), s2 (14 h – 16 h 30, après la pause) et s3 (16 h 30 – 19 h), tables
   * t1 et t2 ; Élodie (g1) disponible partout, Kaïros (g2) sur s1 seulement.
   */
  const withThreeSlots = () => {
    const convention = aConvention();
    convention.addTimeSlot('s3', at('16:30'), at('19:00'));
    convention.declareAvailability('g1', 's3');
    return convention;
  };

  it('prend le créneau consécutif, sur la même table, même séparé par une pause', () => {
    const convention = withThreeSlots();

    convention.schedule('p1', double, 's1', 't1');

    expect(convention.games).toEqual([
      expect.objectContaining({ id: 'p1', tableId: 't1', timeSlotIds: ['s1', 's2'] }),
    ]);
  });

  it('refuse le dernier créneau : pas de créneau suivant', () => {
    expect(refusalOf(() => withThreeSlots().schedule('p1', double, 's3', 't1'))).toMatchObject({
      code: 'no-next-time-slot',
      params: { rank: 3 },
    });
  });

  it('refuse un MJ qui mène déjà une partie sur le second créneau', () => {
    const convention = withThreeSlots();
    convention.schedule('p1', neons, 's2', 't2');

    expect(refusalOf(() => convention.schedule('p2', double, 's1', 't1'))).toMatchObject({
      code: 'game-master-busy',
      params: { nickname: 'Élodie', rank: 2 },
    });
  });

  it('refuse une table prise sur le second créneau', () => {
    const convention = withThreeSlots();
    convention.declareAvailability('g2', 's2');
    convention.schedule('p1', brumes, 's2', 't1');

    expect(refusalOf(() => convention.schedule('p2', double, 's1', 't1'))).toMatchObject({
      code: 'table-taken',
      params: { table: 'Table 1', rank: 2 },
    });
  });

  it('refuse un MJ indisponible sur le second créneau', () => {
    const convention = withThreeSlots();
    convention.withdrawAvailability('g1', 's2');

    expect(refusalOf(() => convention.schedule('p1', double, 's1', 't1'))).toMatchObject({
      code: 'game-master-unavailable',
      params: { nickname: 'Élodie', rank: 2 },
    });
  });

  it("donne pour chaque case le refus même de l'écriture", () => {
    const verdicts = withThreeSlots()
      .placementsOf(double)
      .map(({ timeSlotId, tableId, refusal }) => [timeSlotId, tableId, refusal?.code ?? null]);

    expect(verdicts).toEqual([
      ['s1', 't1', null],
      ['s1', 't2', null],
      ['s2', 't1', null],
      ['s2', 't2', null],
      ['s3', 't1', 'no-next-time-slot'],
      ['s3', 't2', 'no-next-time-slot'],
    ]);
  });
});

describe('Créneau inséré dans une partie double (PR-11)', () => {
  /** « p1 » double sur s1 (9 h – 11 h 30) et s2 (14 h – 16 h 30), à la table t1. */
  const withDouble = () => {
    const convention = aConvention();
    convention.schedule('p1', aScenario('d', 'g1', 2), 's1', 't1');
    return convention;
  };

  it("refuse d'ajouter un créneau dans la pause", () => {
    const convention = withDouble();

    expect(refusalOf(() => convention.addTimeSlot('s3', at('12:00'), at('13:00')))).toMatchObject({
      code: 'time-slot-splits-two-slot-game',
      params: { rank: 1 },
    });
    expect(convention.timeSlots.map(({ id }) => id)).toEqual(['s1', 's2']);
  });

  it("refuse d'y déplacer un créneau par ses heures", () => {
    const convention = withDouble();
    convention.addTimeSlot('s3', at('17:00'), at('19:30'));

    expect(
      refusalOf(() => convention.changeTimeSlotHours('s3', at('12:00'), at('13:00'))),
    ).toMatchObject({ code: 'time-slot-splits-two-slot-game', params: { rank: 1 } });
  });

  it('accepte un créneau avant ou après la partie double', () => {
    const convention = withDouble();

    convention.addTimeSlot('s0', at('07:00'), at('08:30'));
    convention.addTimeSlot('s3', at('17:00'), at('19:30'));

    expect(convention.timeSlots.map(({ id }) => id)).toEqual(['s0', 's1', 's2', 's3']);
  });
});

describe('Ce qui porte des parties (PR-10)', () => {
  it('refuse de supprimer un créneau qui porte des parties, avec leur nombre', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', brumes, 's1', 't2');

    expect(refusalOf(() => convention.removeTimeSlot('s1'))).toMatchObject({
      code: 'time-slot-has-games',
      params: { rank: 1, games: 2 },
    });
    convention.removeTimeSlot('s2');
    expect(convention.timeSlots.map(({ id }) => id)).toEqual(['s1']);
    convention.unschedule('p1');
    convention.unschedule('p2');
    convention.removeTimeSlot('s1');
    expect(convention.timeSlots).toEqual([]);
  });

  it('refuse de supprimer une table qui porte des parties, avec leur nombre', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    expect(refusalOf(() => convention.removeTable('t1'))).toMatchObject({
      code: 'table-has-games',
      params: { name: 'Table 1', games: 1 },
    });
    convention.removeTable('t2');
    expect(convention.tables.map(({ id }) => id)).toEqual(['t1']);
    convention.renameTable('t1', 'Dragon');
    expect(convention.tables[0]!.name.text).toBe('Dragon');
    convention.unschedule('p1');
    convention.removeTable('t1');
    expect(convention.tables).toEqual([]);
  });
});

describe('Une disponibilité qui porte une partie (PR-15)', () => {
  it('refuse de la retirer, puis accepte après la déprogrammation', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    expect(refusalOf(() => convention.withdrawAvailability('g1', 's1'))).toMatchObject({
      code: 'availability-has-game',
      params: { nickname: 'Élodie', rank: 1 },
    });
    convention.unschedule('p1');
    convention.withdrawAvailability('g1', 's1');
    expect(convention.gameMasters[0]!.isAvailableOn('s1')).toBe(false);
  });

  it('refuse de retirer le second créneau d’une partie double', () => {
    const convention = aConvention();
    convention.schedule('p1', aScenario('d', 'g1', 2), 's1', 't1');

    expect(refusalOf(() => convention.withdrawAvailability('g1', 's2'))).toMatchObject({
      code: 'availability-has-game',
      params: { rank: 2 },
    });
  });

  it('donne, pour chaque disponibilité du MJ, le refus même du retrait, ou rien', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's2', 't1');

    const withdrawals = convention.withdrawalsOf('g1');

    expect(
      withdrawals.map(({ timeSlotId, refusal }) => [timeSlotId, refusal?.code ?? null]),
    ).toEqual([
      ['s1', null],
      ['s2', 'availability-has-game'],
    ]);
    expect(withdrawals[1]!.refusal).toEqual(
      refusalOf(() => convention.withdrawAvailability('g1', 's2')),
    );
    expect(convention.withdrawalsOf('g2')).toEqual([{ timeSlotId: 's1', refusal: null }]);
  });
});

describe('Heures d’un créneau qui porte une partie (PR-11)', () => {
  it('refuse de les changer, avec le nombre de parties', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', brumes, 's1', 't2');

    expect(
      refusalOf(() => convention.changeTimeSlotHours('s1', at('08:00'), at('10:30'))),
    ).toMatchObject({ code: 'time-slot-hours-locked-by-games', params: { rank: 1, games: 2 } });
  });

  it('les accepte une fois les parties déprogrammées et les disponibilités retirées', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.unschedule('p1');
    convention.withdrawAvailability('g1', 's1');
    convention.withdrawAvailability('g2', 's1');

    convention.changeTimeSlotHours('s1', at('08:00'), at('10:30'));

    expect(convention.timeSlots[0]!.start.equals(at('08:00'))).toBe(true);
  });
});

describe('Scénario qui a des parties (PR-14)', () => {
  it('refuse de changer sa durée, puis accepte après la déprogrammation', () => {
    const convention = aConvention();
    const scenario = aScenario('e', 'g1');
    convention.schedule('p1', scenario, 's1', 't1');

    expect(refusalOf(() => scenario.changeDuration(2, convention))).toMatchObject({
      code: 'scenario-duration-locked',
    });
    scenario.changeDuration(1, convention);
    convention.unschedule('p1');
    scenario.changeDuration(2, convention);
    expect(scenario.duration).toBe(2);
  });

  it('refuse de le supprimer, puis accepte après la déprogrammation', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    expect(refusalOf(() => neons.remove(convention))).toMatchObject({
      code: 'scenario-has-games',
    });
    expect(convention.hasGamesOf('a')).toBe(true);
    expect(convention.hasGamesOf('b')).toBe(false);
    convention.unschedule('p1');
    expect(() => neons.remove(convention)).not.toThrow();
  });
});

describe('Verdicts de placement', () => {
  it("donne, pour chaque case, le refus même de l'écriture, ou rien", () => {
    const withOneGame = () => {
      const convention = aConvention();
      convention.schedule('p1', neons, 's1', 't1');
      return convention;
    };

    const verdicts = withOneGame().placementsOf(brumes);

    expect(
      verdicts.map(({ timeSlotId, tableId, refusal }) => [
        timeSlotId,
        tableId,
        refusal?.code ?? null,
      ]),
    ).toEqual([
      ['s1', 't1', 'table-taken'],
      ['s1', 't2', null],
      ['s2', 't1', 'game-master-unavailable'],
      ['s2', 't2', 'game-master-unavailable'],
    ]);
    for (const { timeSlotId, tableId, refusal } of verdicts) {
      const copy = withOneGame();
      if (refusal)
        expect(refusalOf(() => copy.schedule('p2', brumes, timeSlotId, tableId))).toEqual(refusal);
      else expect(() => copy.schedule('p2', brumes, timeSlotId, tableId)).not.toThrow();
    }
  });
});

describe('Déplacer une partie (PR-17)', () => {
  /** Ce que la frise montre d'une partie : son identité, sa table, ses créneaux et ses places. */
  const placeOf = (convention: Convention, gameId: string) => {
    const game = convention.games.find(({ id }) => id === gameId)!;
    return [game.tableId, game.timeSlotIds];
  };

  it('déplace une partie vers un autre créneau, puis vers une autre table', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    convention.moveGame('p1', 's2', 't1');
    expect(placeOf(convention, 'p1')).toEqual(['t1', ['s2']]);
    convention.moveGame('p1', 's2', 't2');
    expect(placeOf(convention, 'p1')).toEqual(['t2', ['s2']]);
  });

  it('accepte sa propre case, sans rien changer', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    convention.moveGame('p1', 's1', 't1');

    expect(placeOf(convention, 'p1')).toEqual(['t1', ['s1']]);
  });

  it("garde l'identité de la partie, son scénario, ses places et sa place dans le programme", () => {
    const seats = Seats.of(2, 6);
    const convention = Convention.restore({
      id: 'c1',
      name: 'Histoires de Chimères',
      date: null,
      timeSlots: [
        new TimeSlot('s1', at('09:00'), at('11:30')),
        new TimeSlot('s2', at('14:00'), at('16:30')),
      ],
      tables: [
        new Table('t1', ComparableName.of('Table 1')),
        new Table('t2', ComparableName.of('Table 2')),
      ],
      gameMasters: [
        new GameMaster('g1', ComparableName.of('Élodie'), ['s1', 's2']),
        new GameMaster('g2', ComparableName.of('Kaïros'), ['s1']),
      ],
      games: [
        new Game('p1', 'a', 'g1', 't1', ['s1'], seats),
        new Game('p2', 'c', 'g2', 't2', ['s1']),
      ],
      version: 0,
    });

    convention.moveGame('p1', 's2', 't1');

    expect(convention.games).toEqual([
      new Game('p1', 'a', 'g1', 't1', ['s2'], seats),
      new Game('p2', 'c', 'g2', 't2', ['s1']),
    ]);
  });

  it('refuse une case prise par une autre partie', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', brumes, 's1', 't2');

    expect(refusalOf(() => convention.moveGame('p1', 's1', 't2'))).toMatchObject({
      code: 'table-taken',
      params: { table: 'Table 2', rank: 1 },
    });
  });

  it('refuse un créneau où le MJ mène déjà une partie', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', ruines, 's2', 't1');

    expect(refusalOf(() => convention.moveGame('p1', 's2', 't2'))).toMatchObject({
      code: 'game-master-busy',
      params: { nickname: 'Élodie', rank: 2 },
    });
  });

  it('refuse un créneau où le MJ est indisponible', () => {
    const convention = aConvention();
    convention.schedule('p1', brumes, 's1', 't1');

    expect(refusalOf(() => convention.moveGame('p1', 's2', 't1')).code).toBe(
      'game-master-unavailable',
    );
  });

  it('refuse une partie, un créneau ou une table inconnus', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    expect(refusalOf(() => convention.moveGame('x', 's1', 't1')).code).toBe('game-not-found');
    expect(refusalOf(() => convention.moveGame('p1', 'x', 't1')).code).toBe('time-slot-not-found');
    expect(refusalOf(() => convention.moveGame('p1', 's1', 'x')).code).toBe('table-not-found');
  });

  describe('une partie double', () => {
    /** Créneaux s1, s2 et s3, table t1 ; MJ g1 disponible partout ; « p1 » double sur s1 et s2. */
    const withDouble = () =>
      Convention.restore({
        id: 'c1',
        name: 'Histoires de Chimères',
        date: null,
        timeSlots: [
          new TimeSlot('s3', at('17:00'), at('19:30')),
          new TimeSlot('s1', at('09:00'), at('11:30')),
          new TimeSlot('s2', at('14:00'), at('16:30')),
        ],
        tables: [new Table('t1', ComparableName.of('Table 1'))],
        gameMasters: [new GameMaster('g1', ComparableName.of('Élodie'), ['s1', 's2', 's3'])],
        games: [new Game('p1', 'd', 'g1', 't1', ['s1', 's2'])],
        version: 0,
      });

    it('se déplace par son premier créneau, et prend le suivant avec lui', () => {
      const convention = withDouble();

      convention.moveGame('p1', 's2', 't1');

      expect(placeOf(convention, 'p1')).toEqual(['t1', ['s2', 's3']]);
    });

    it('ne se déplace pas sur le dernier créneau : il n’a pas de créneau suivant', () => {
      expect(refusalOf(() => withDouble().moveGame('p1', 's3', 't1'))).toMatchObject({
        code: 'no-next-time-slot',
        params: { rank: 3 },
      });
    });
  });
});

describe('Déprogrammer une partie (PR-17)', () => {
  it('retire la partie du programme : son scénario revient dans la réserve', () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', brumes, 's1', 't2');

    convention.unschedule('p1');

    expect(convention.games.map(({ id }) => id)).toEqual(['p2']);
    const catalogue = ScenarioCatalogue.restore([
      { id: neons.id, gameMasterId: 'g1', duration: 1 },
    ]);
    expect(convention.reserve(catalogue)[0]!.timeSlots[0]).toMatchObject({
      inReserve: true,
      scheduled: false,
    });
  });

  it('refuse une partie inconnue', () => {
    expect(refusalOf(() => aConvention().unschedule('x')).code).toBe('game-not-found');
  });
});

describe('Verdicts de déplacement', () => {
  it('donne, pour chaque case, le refus même du déplacement, sans compter la partie elle-même', () => {
    const withTwoGames = () => {
      const convention = aConvention();
      convention.schedule('p1', neons, 's1', 't1');
      convention.schedule('p2', brumes, 's1', 't2');
      return convention;
    };

    const verdicts = withTwoGames().movePlacementsOf('p2');

    expect(
      verdicts.map(({ timeSlotId, tableId, refusal }) => [
        timeSlotId,
        tableId,
        refusal?.code ?? null,
      ]),
    ).toEqual([
      ['s1', 't1', 'table-taken'],
      ['s1', 't2', null],
      ['s2', 't1', 'game-master-unavailable'],
      ['s2', 't2', 'game-master-unavailable'],
    ]);
    for (const { timeSlotId, tableId, refusal } of verdicts) {
      const copy = withTwoGames();
      if (refusal)
        expect(refusalOf(() => copy.moveGame('p2', timeSlotId, tableId))).toEqual(refusal);
      else expect(() => copy.moveGame('p2', timeSlotId, tableId)).not.toThrow();
    }
  });

  it('refuse une partie inconnue', () => {
    expect(refusalOf(() => aConvention().movePlacementsOf('x')).code).toBe('game-not-found');
  });
});

describe('Réserve (PR-6)', () => {
  const catalogue = ScenarioCatalogue.restore(
    [neons, ruines, brumes, aScenario('d', 'g1', 2)].map(({ id, gameMasterId, duration }) => ({
      id,
      gameMasterId,
      duration,
    })),
  );

  /** `réserve` ou `programmé` par créneau, `-` pour ni l'un ni l'autre. */
  const placesOf = (convention: Convention, scenarios = catalogue) =>
    Object.fromEntries(
      convention
        .reserve(scenarios)
        .map(({ scenarioId, timeSlots }) => [
          scenarioId,
          timeSlots.map(({ inReserve, scheduled }) =>
            inReserve ? 'réserve' : scheduled ? 'programmé' : '-',
          ),
        ]),
    );

  it('rend, pour chaque scénario, les créneaux où son MJ est disponible', () => {
    expect(placesOf(aConvention())).toEqual({
      a: ['réserve', 'réserve'],
      b: ['réserve', 'réserve'],
      c: ['réserve', '-'],
      d: ['réserve', '-'],
    });
    expect(aConvention().reserve(catalogue)[0]).toEqual({
      scenarioId: 'a',
      timeSlots: [
        { timeSlotId: 's1', inReserve: true, scheduled: false },
        { timeSlotId: 's2', inReserve: true, scheduled: false },
      ],
      unschedulable: null,
    });
  });

  it("retire d'un créneau les scénarios dont le MJ y mène déjà une partie", () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');

    expect(placesOf(convention)).toEqual({
      a: ['programmé', 'réserve'],
      b: ['-', 'réserve'],
      c: ['réserve', '-'],
      d: ['-', '-'],
    });
  });

  it('garde un scénario programmé ailleurs, et ignore les tables libres', () => {
    const convention = aConvention();
    convention.schedule('p1', brumes, 's1', 't1');
    convention.schedule('p2', neons, 's1', 't2');

    expect(placesOf(convention)).toEqual({
      a: ['programmé', 'réserve'],
      b: ['-', 'réserve'],
      c: ['programmé', '-'],
      d: ['-', '-'],
    });
  });

  it("dit pourquoi un scénario n'a aucun créneau possible : son MJ n'a aucune disponibilité", () => {
    const convention = aConvention();
    convention.withdrawAvailability('g2', 's1');

    const [, , brumesReserve] = convention.reserve(catalogue);
    expect(brumesReserve!.timeSlots.some(({ inReserve }) => inReserve)).toBe(false);
    expect(brumesReserve!.unschedulable).toMatchObject({
      code: 'game-master-without-availability',
      params: { nickname: 'Kaïros' },
    });
  });

  it('… ou son MJ mène déjà une autre partie sur chacune de ses disponibilités', () => {
    const abysses = aScenario('e', 'g2');
    const withAbysses = ScenarioCatalogue.restore(
      [neons, ruines, brumes, abysses].map(({ id, gameMasterId, duration }) => ({
        id,
        gameMasterId,
        duration,
      })),
    );
    const convention = aConvention();
    convention.schedule('p1', brumes, 's1', 't1');

    const [, , brumesReserve, abyssesReserve] = convention.reserve(withAbysses);
    expect(abyssesReserve!.unschedulable).toMatchObject({
      code: 'game-master-busy-everywhere',
      params: { nickname: 'Kaïros' },
    });
    // Programmé, un scénario n'est pas oublié : il n'est pas grisé.
    expect(brumesReserve!.unschedulable).toBeNull();
  });

  describe('un scénario double', () => {
    const double = aScenario('e', 'g2', 2);
    const withDouble = ScenarioCatalogue.restore([
      { id: double.id, gameMasterId: 'g2', duration: 2 },
    ]);
    /** Kaïros (g2) disponible sur s1 et s2, puis s3 (17 h – 19 h 30), sans disponibilité. */
    const withThreeSlots = () => {
      const convention = aConvention();
      convention.addTimeSlot('s3', at('17:00'), at('19:30'));
      convention.declareAvailability('g2', 's2');
      return convention;
    };

    it("n'est en réserve que si son MJ est aussi disponible et libre sur le créneau suivant", () => {
      const convention = withThreeSlots();
      convention.declareAvailability('g2', 's3');
      expect(placesOf(convention, withDouble)).toEqual({ e: ['réserve', 'réserve', '-'] });

      convention.schedule('p1', brumes, 's2', 't1');
      expect(placesOf(convention, withDouble)).toEqual({ e: ['-', '-', '-'] });
    });

    it('est programmé sur ses deux créneaux', () => {
      const convention = withThreeSlots();
      convention.schedule('p1', double, 's1', 't1');

      expect(placesOf(convention, withDouble)).toEqual({ e: ['programmé', 'programmé', '-'] });
    });

    it("dit pourquoi il n'a aucun créneau possible : son MJ n'a pas deux créneaux consécutifs", () => {
      const convention = aConvention();

      expect(convention.reserve(withDouble)[0]!.unschedulable).toMatchObject({
        code: 'game-master-without-consecutive-availabilities',
        params: { nickname: 'Kaïros' },
      });
    });

    it('… ou son MJ mène déjà une partie sur chacune de ses paires de créneaux consécutifs', () => {
      const convention = withThreeSlots();
      convention.schedule('p1', brumes, 's1', 't1');

      expect(convention.reserve(withDouble)[0]!.unschedulable).toMatchObject({
        code: 'game-master-busy-everywhere',
        params: { nickname: 'Kaïros' },
      });
    });
  });
});
