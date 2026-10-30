import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Convention } from './convention.js';
import { PresenceCode } from './presence-code.js';
import { TimeOfDay } from './time-of-day.js';

function aConvention(): Convention {
  return Convention.restore({
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

const at = TimeOfDay.parse;

/** Les créneaux dans l'ordre de la journée : rang, identifiant et heures. */
function scheduleOf(convention: Convention): string[] {
  return convention.timeSlots.map(
    (slot) => `${convention.rankOfTimeSlot(slot.id)} ${slot.id} ${slot.start}-${slot.end}`,
  );
}

describe('Créneaux de la convention', () => {
  it('ajoute un créneau, de rang 1', () => {
    const convention = aConvention();

    convention.addTimeSlot('s1', at('09:00'), at('11:30'));

    expect(scheduleOf(convention)).toEqual(['1 s1 09:00-11:30']);
  });

  it('recalcule les rangs après un créneau inséré avant les autres', () => {
    const convention = aConvention();
    convention.addTimeSlot('s1', at('14:00'), at('16:30'));
    convention.addTimeSlot('s2', at('17:00'), at('19:30'));

    convention.addTimeSlot('s0', at('09:00'), at('11:30'));

    expect(scheduleOf(convention)).toEqual([
      '1 s0 09:00-11:30',
      '2 s1 14:00-16:30',
      '3 s2 17:00-19:30',
    ]);
  });

  it.each([
    ['avant le début', '10:00'],
    ['à l’heure du début', '11:00'],
  ])('refuse une fin %s', (_, end) => {
    const convention = aConvention();

    const refusal = refusalOf(() => convention.addTimeSlot('s1', at('11:00'), at(end)));

    expect(refusal.code).toBe('time-slot-end-not-after-start');
    expect(convention.timeSlots).toEqual([]);
  });

  describe('chevauchements', () => {
    /** Créneau 1 : 9 h – 11 h 30 ; créneau 2 : 14 h – 16 h 30. */
    function aDay(): Convention {
      const convention = aConvention();
      convention.addTimeSlot('s1', at('09:00'), at('11:30'));
      convention.addTimeSlot('s2', at('14:00'), at('16:30'));
      return convention;
    }

    it.each([
      ['identique', '14:00', '16:30', 'time-slot-start-overlaps'],
      ['inclus dans le créneau 2', '14:30', '15:30', 'time-slot-start-overlaps'],
      ['qui commence pendant le créneau 2', '16:00', '18:00', 'time-slot-start-overlaps'],
      ['qui finit pendant le créneau 2', '12:00', '14:30', 'time-slot-end-overlaps'],
      ['qui contient le créneau 2', '13:00', '17:00', 'time-slot-end-overlaps'],
    ])('refuse un créneau %s, en nommant le créneau 2', (_, start, end, code) => {
      const convention = aDay();

      const refusal = refusalOf(() => convention.addTimeSlot('s3', at(start), at(end)));

      expect(refusal.code).toBe(code);
      expect(refusal.params).toEqual({ rank: 2 });
      expect(convention.timeSlots).toHaveLength(2);
    });

    it('accepte deux créneaux bout à bout, avant et après', () => {
      const convention = aDay();

      convention.addTimeSlot('s0', at('08:00'), at('09:00'));
      convention.addTimeSlot('s3', at('11:30'), at('14:00'));

      expect(scheduleOf(convention)).toEqual([
        '1 s0 08:00-09:00',
        '2 s1 09:00-11:30',
        '3 s3 11:30-14:00',
        '4 s2 14:00-16:30',
      ]);
    });
  });

  describe('heures changées', () => {
    it('déplace le créneau, et son rang suit', () => {
      const convention = aConvention();
      convention.addTimeSlot('s1', at('09:00'), at('11:30'));
      convention.addTimeSlot('s2', at('14:00'), at('16:30'));

      convention.changeTimeSlotHours('s1', at('17:00'), at('19:00'));

      expect(scheduleOf(convention)).toEqual(['1 s2 14:00-16:30', '2 s1 17:00-19:00']);
    });

    it('ne compte pas le créneau lui-même comme un chevauchement', () => {
      const convention = aConvention();
      convention.addTimeSlot('s1', at('09:00'), at('11:30'));

      convention.changeTimeSlotHours('s1', at('10:00'), at('12:30'));

      expect(scheduleOf(convention)).toEqual(['1 s1 10:00-12:30']);
    });

    it('refuse un chevauchement, sans rien changer', () => {
      const convention = aConvention();
      convention.addTimeSlot('s1', at('09:00'), at('11:30'));
      convention.addTimeSlot('s2', at('14:00'), at('16:30'));

      const refusal = refusalOf(() =>
        convention.changeTimeSlotHours('s1', at('09:00'), at('15:00')),
      );

      expect(refusal.code).toBe('time-slot-end-overlaps');
      expect(scheduleOf(convention)).toEqual(['1 s1 09:00-11:30', '2 s2 14:00-16:30']);
    });
  });

  it('supprime un créneau, et les rangs suivent', () => {
    const convention = aConvention();
    convention.addTimeSlot('s1', at('09:00'), at('11:30'));
    convention.addTimeSlot('s2', at('14:00'), at('16:30'));

    convention.removeTimeSlot('s1');

    expect(scheduleOf(convention)).toEqual(['1 s2 14:00-16:30']);
  });

  it.each([
    ['changer ses heures', (c: Convention) => c.changeTimeSlotHours('x', at('09:00'), at('10:00'))],
    ['le supprimer', (c: Convention) => c.removeTimeSlot('x')],
  ])('refuse de %s pour un créneau inconnu', (_, action) => {
    const convention = aConvention();

    expect(refusalOf(() => action(convention)).code).toBe('time-slot-not-found');
  });
});

describe('TimeOfDay', () => {
  it('lit et écrit une heure HH:MM', () => {
    expect(at('09:05').minutes).toBe(545);
    expect(TimeOfDay.fromMinutes(545).toString()).toBe('09:05');
  });

  it.each(['24:00', '9:00', '12:60', ''])(
    'refuse « %s » : une heure du jour, sans passer minuit',
    (text) => {
      expect(() => at(text)).toThrow(RangeError);
    },
  );
});
