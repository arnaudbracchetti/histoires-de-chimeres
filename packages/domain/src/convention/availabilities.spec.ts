import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Convention } from './convention.js';
import { PresenceCode } from './presence-code.js';
import { TimeOfDay } from './time-of-day.js';

const at = TimeOfDay.parse;

/** Créneau s1 : 9 h – 11 h 30 ; créneau s2 : 14 h – 16 h 30. MJ g1 « Élodie » et g2 « Kaïros ». */
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
    presenceCode: PresenceCode.of('K7M2'),
  });
  convention.addTimeSlot('s1', at('09:00'), at('11:30'));
  convention.addTimeSlot('s2', at('14:00'), at('16:30'));
  convention.addGameMaster('g1', 'Élodie');
  convention.addGameMaster('g2', 'Kaïros');
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

/** Les créneaux où le MJ est disponible, dans l'ordre de la journée. */
const availabilitiesOf = (convention: Convention, gameMasterId: string) => {
  const gameMaster = convention.gameMasters.find(({ id }) => id === gameMasterId)!;
  return convention.timeSlots
    .filter((slot) => gameMaster.isAvailableOnTimeSlot(slot.id))
    .map(({ id }) => id);
};

describe('Disponibilités des MJ (PR-2)', () => {
  it('déclare et retire une disponibilité', () => {
    const convention = aConvention();

    convention.declareAvailability('g1', 's2');
    convention.declareAvailability('g1', 's1');
    expect(availabilitiesOf(convention, 'g1')).toEqual(['s1', 's2']);

    convention.withdrawAvailability('g1', 's2');
    expect(availabilitiesOf(convention, 'g1')).toEqual(['s1']);
  });

  it('déclarer deux fois, ou retirer une disponibilité absente, ne change rien', () => {
    const convention = aConvention();

    convention.declareAvailability('g1', 's1');
    convention.declareAvailability('g1', 's1');
    convention.withdrawAvailability('g1', 's2');

    expect(availabilitiesOf(convention, 'g1')).toEqual(['s1']);
    expect(convention.availabilityCountOnTimeSlot('s1')).toBe(1);
  });

  it('garde les disponibilités d’un MJ qui change de pseudo', () => {
    const convention = aConvention();
    convention.declareAvailability('g1', 's1');

    convention.renameGameMaster('g1', 'Élodie la Rouge');

    expect(availabilitiesOf(convention, 'g1')).toEqual(['s1']);
  });

  it('compte les disponibilités de chaque créneau', () => {
    const convention = aConvention();
    convention.declareAvailability('g1', 's1');
    convention.declareAvailability('g2', 's1');
    convention.declareAvailability('g2', 's2');

    expect(convention.availabilityCountOnTimeSlot('s1')).toBe(2);
    expect(convention.availabilityCountOnTimeSlot('s2')).toBe(1);
  });

  it.each([
    ['déclarer', (c: Convention) => c.declareAvailability('g1', 'x')],
    ['retirer', (c: Convention) => c.withdrawAvailability('g1', 'x')],
  ])('refuse de %s une disponibilité sur un créneau inconnu', (_, action) => {
    const convention = aConvention();

    expect(refusalOf(() => action(convention)).code).toBe('time-slot-not-found');
  });

  it.each([
    ['déclarer', (c: Convention) => c.declareAvailability('x', 's1')],
    ['retirer', (c: Convention) => c.withdrawAvailability('x', 's1')],
  ])('refuse de %s une disponibilité pour un MJ inconnu', (_, action) => {
    const convention = aConvention();

    expect(refusalOf(() => action(convention)).code).toBe('game-master-not-found');
  });

  it('supprimer un créneau supprime ses disponibilités (PR-10)', () => {
    const convention = aConvention();
    convention.declareAvailability('g1', 's1');
    convention.declareAvailability('g1', 's2');
    convention.declareAvailability('g2', 's1');

    convention.removeTimeSlot('s1');

    expect(availabilitiesOf(convention, 'g1')).toEqual(['s2']);
    expect(availabilitiesOf(convention, 'g2')).toEqual([]);
    // Un créneau recréé ne retrouve rien.
    convention.addTimeSlot('s3', at('09:00'), at('11:30'));
    expect(convention.availabilityCountOnTimeSlot('s3')).toBe(0);
  });

  it('supprimer un MJ supprime ses disponibilités (PR-12)', () => {
    const convention = aConvention();
    convention.declareAvailability('g1', 's1');
    convention.declareAvailability('g2', 's1');

    convention.removeGameMaster('g1', ScenarioCatalogue.restore([]));

    expect(convention.availabilityCountOnTimeSlot('s1')).toBe(1);
  });

  describe('heures figées (PR-11)', () => {
    it('refuse de changer les heures d’un créneau qui porte une disponibilité, sans rien changer', () => {
      const convention = aConvention();
      convention.declareAvailability('g1', 's2');
      convention.declareAvailability('g2', 's2');

      const refusal = refusalOf(() =>
        convention.changeTimeSlotHours('s2', at('15:00'), at('17:00')),
      );

      expect(refusal.code).toBe('time-slot-hours-locked');
      expect(refusal.params).toEqual({ rank: 2, availabilities: 2 });
      expect(convention.timeSlots.map((slot) => `${slot.start}-${slot.end}`)).toEqual([
        '09:00-11:30',
        '14:00-16:30',
      ]);
    });

    it('accepte les mêmes heures, réenregistrées', () => {
      const convention = aConvention();
      convention.declareAvailability('g1', 's2');

      convention.changeTimeSlotHours('s2', at('14:00'), at('16:30'));

      expect(convention.availabilityCountOnTimeSlot('s2')).toBe(1);
    });

    it('rend les heures modifiables une fois la dernière disponibilité retirée', () => {
      const convention = aConvention();
      convention.declareAvailability('g1', 's2');
      convention.withdrawAvailability('g1', 's2');

      convention.changeTimeSlotHours('s2', at('15:00'), at('17:00'));

      expect(convention.timeSlots[1]!.start.toString()).toBe('15:00');
    });
  });
});
