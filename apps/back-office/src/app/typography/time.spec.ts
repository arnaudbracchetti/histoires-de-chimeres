import { NBSP, THIN_NBSP } from './french';
import { formatDuration, formatTime, formatTimeRange, formatTimeSlotRanks, timeSlotLabel } from './time';

describe('Heures et durées', () => {
  it('écrit une heure « 14 h 00 », sans zéro devant l’heure', () => {
    expect(formatTime('14:00')).toBe(`14${NBSP}h${NBSP}00`);
    expect(formatTime('09:30')).toBe(`9${NBSP}h${NBSP}30`);
  });

  it('écrit une plage avec un demi-cadratin entouré d’espaces fines insécables', () => {
    expect(formatTimeRange('14:00', '16:30')).toBe(
      `14${NBSP}h${NBSP}00${THIN_NBSP}–${THIN_NBSP}16${NBSP}h${NBSP}30`,
    );
  });

  it('écrit une durée en heures et minutes, en heures seules ou en minutes seules', () => {
    expect(formatDuration('14:00', '16:30')).toBe(`2${NBSP}h${NBSP}30`);
    expect(formatDuration('14:00', '16:00')).toBe(`2${NBSP}h`);
    expect(formatDuration('12:15', '13:00')).toBe(`45${NBSP}min`);
  });

  it('désigne un créneau par son rang, puis sa plage', () => {
    expect(timeSlotLabel({ rank: 2, start: '14:00', end: '16:30' })).toBe(
      `Créneau 2 · 14${NBSP}h${NBSP}00${THIN_NBSP}–${THIN_NBSP}16${NBSP}h${NBSP}30`,
    );
  });

  it('nomme des créneaux par leur rang, accordé au nombre', () => {
    expect(formatTimeSlotRanks([])).toBe('');
    expect(formatTimeSlotRanks([2])).toBe('créneau 2');
    expect(formatTimeSlotRanks([1, 3])).toBe('créneaux 1 et 3');
    expect(formatTimeSlotRanks([2, 3, 4])).toBe('créneaux 2, 3 et 4');
  });
});
