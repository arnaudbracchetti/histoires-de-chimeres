import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Convention } from './convention.js';
import { TimeOfDay } from './time-of-day.js';

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

  it("donne d'abord l'indisponibilité, puis le MJ occupé, puis la table prise", () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's1', 't1');
    convention.schedule('p2', brumes, 's1', 't2');

    expect(refusalOf(() => convention.schedule('p3', ruines, 's1', 't2')).code).toBe(
      'game-master-busy',
    );
    convention.withdrawAvailability('g1', 's1');
    expect(refusalOf(() => convention.schedule('p3', ruines, 's1', 't1')).code).toBe(
      'game-master-unavailable',
    );
  });

  it("donne l'indisponibilité avant la table prise", () => {
    const convention = aConvention();
    convention.schedule('p1', neons, 's2', 't1');

    expect(refusalOf(() => convention.schedule('p2', brumes, 's2', 't1')).code).toBe(
      'game-master-unavailable',
    );
  });

  it("ne programme qu'un scénario d'un créneau, et n'en donne aucun verdict", () => {
    const double = aScenario('d', 'g1', 2);

    expect(() => aConvention().schedule('p1', double, 's1', 't1')).toThrow(RangeError);
    expect(() => aConvention().placementsOf(double)).toThrow(RangeError);
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

  it("rend, pour chaque scénario d'un créneau, les créneaux où son MJ est disponible", () => {
    expect(placesOf(aConvention())).toEqual({
      a: ['réserve', 'réserve'],
      b: ['réserve', 'réserve'],
      c: ['réserve', '-'],
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
});
