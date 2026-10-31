import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Convention } from './convention.js';
import type { LocalMoment } from './local-moment.js';
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
    presenceCode: PresenceCode.parse('K7M2'),
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

/** L'heure locale `AAAA-MM-JJ HH:MM`. */
function at(moment: string): LocalMoment {
  const [date, time] = moment.split(' ');
  return { date: date!, time: TimeOfDay.parse(time!) };
}

/** Une convention le 14 mars 2027, de 9 h 00 à 18 h 30, en deux créneaux. */
function aConventionOnMarch14(): Convention {
  const convention = aConvention();
  convention.changeDate('2027-03-14');
  convention.addTimeSlot('s2', TimeOfDay.parse('14:00'), TimeOfDay.parse('18:30'));
  convention.addTimeSlot('s1', TimeOfDay.parse('09:00'), TimeOfDay.parse('11:30'));
  return convention;
}

describe('Convention', () => {
  it('se renomme, sans les espaces du début et de la fin', () => {
    const convention = aConvention();

    convention.rename('  Histoires de Chimères 2027 ');

    expect(convention.name).toBe('Histoires de Chimères 2027');
  });

  it('refuse un nom vide', () => {
    const convention = aConvention();

    const refusal = refusalOf(() => convention.rename('   '));

    expect(refusal.code).toBe('convention-name-required');
    expect(convention.name).toBe('Histoires de Chimères');
  });

  it('accepte un nom de 80 caractères, refuse un nom de 81', () => {
    const convention = aConvention();

    convention.rename('a'.repeat(80));
    const refusal = refusalOf(() => convention.rename('a'.repeat(81)));

    expect(convention.name).toBe('a'.repeat(80));
    expect(refusal.code).toBe('convention-name-too-long');
    expect(refusal.params).toEqual({ max: 80 });
  });

  it('fixe sa date, puis la change', () => {
    const convention = aConvention();

    convention.changeDate('2027-03-14');
    convention.changeDate('2027-03-21');

    expect(convention.date).toBe('2027-03-21');
  });

  it('efface sa date', () => {
    const convention = aConvention();
    convention.changeDate('2027-03-14');

    convention.changeDate(null);

    expect(convention.date).toBeNull();
  });

  describe('code de présence (ID-2)', () => {
    it('est fixé à sa création, et se lit', () => {
      expect(aConvention().presenceCode.text).toBe('K7M2');
    });

    it('accepte son code, en minuscules comme en majuscules', () => {
      const convention = aConvention();

      expect(() => convention.verifyEntryAllowed('k7m2', at('2027-03-14 10:00'))).not.toThrow();
    });

    it('refuse un autre code', () => {
      const refusal = refusalOf(() =>
        aConvention().verifyEntryAllowed('K7M3', at('2027-03-14 10:00')),
      );

      expect(refusal.code).toBe('presence-code-wrong');
    });

    it('refuse même son code, une fois terminée', () => {
      const refusal = refusalOf(() =>
        aConventionOnMarch14().verifyEntryAllowed('K7M2', at('2027-03-14 18:30')),
      );

      expect(refusal.code).toBe('convention-ended');
    });

    it('dit qu’elle est terminée avant de regarder le code', () => {
      const refusal = refusalOf(() =>
        aConventionOnMarch14().verifyEntryAllowed('K7M3', at('2027-03-15 08:00')),
      );

      expect(refusal.code).toBe('convention-ended');
    });
  });

  describe('fin, à la fin de son dernier créneau, le jour de sa date', () => {
    it('finit à la fin de son dernier créneau, le jour de sa date', () => {
      expect(aConventionOnMarch14().end).toEqual(at('2027-03-14 18:30'));
    });

    it('n’a pas de fin sans date ou sans créneau', () => {
      const withoutDate = aConventionOnMarch14();
      withoutDate.changeDate(null);
      const withoutTimeSlot = aConvention();
      withoutTimeSlot.changeDate('2027-03-14');

      expect(withoutDate.end).toBeNull();
      expect(withoutTimeSlot.end).toBeNull();
    });

    it.each([
      ['la veille', '2027-03-13 23:59', false],
      ['le jour même, avant le premier créneau', '2027-03-14 08:00', false],
      ['entre deux créneaux', '2027-03-14 12:00', false],
      ['une minute avant la fin du dernier créneau', '2027-03-14 18:29', false],
      ['à la fin du dernier créneau', '2027-03-14 18:30', true],
      ['le soir', '2027-03-14 23:00', true],
      ['le lendemain', '2027-03-15 08:00', true],
      ['un an plus tard', '2028-01-01 00:00', true],
    ])('%s (%s) : terminée = %s', (_, moment, ended) => {
      expect(aConventionOnMarch14().hasEndedAt(at(moment))).toBe(ended);
    });

    it('ne se termine pas sans date', () => {
      const convention = aConventionOnMarch14();
      convention.changeDate(null);

      expect(convention.hasEndedAt(at('2030-01-01 00:00'))).toBe(false);
    });

    it('ne se termine pas sans créneau', () => {
      const convention = aConvention();
      convention.changeDate('2027-03-14');

      expect(convention.hasEndedAt(at('2030-01-01 00:00'))).toBe(false);
    });

    it('refuse, une fois terminée, ce qu’elle ouvre au front office', () => {
      const convention = aConventionOnMarch14();

      expect(() => convention.verifyStillOpenAt(at('2027-03-14 18:29'))).not.toThrow();
      expect(refusalOf(() => convention.verifyStillOpenAt(at('2027-03-14 18:30'))).code).toBe(
        'convention-ended',
      );
    });
  });
});
