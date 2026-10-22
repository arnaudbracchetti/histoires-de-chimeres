import {
  formatDuration,
  formatTime,
  formatTimeRange,
  normalizeTime,
  timeSlotLabel,
} from './time-format';

// Espace insécable (U+00A0) et espace fine insécable (U+202F), écrites en clair.
const NBSP = '\u00a0';
const THIN = '\u202f';

describe('Heures et durées', () => {
  it('écrit une heure « 14 h 00 », sans zéro devant l’heure', () => {
    expect(formatTime('14:00')).toBe(`14${NBSP}h${NBSP}00`);
    expect(formatTime('09:30')).toBe(`9${NBSP}h${NBSP}30`);
  });

  it('écrit une plage avec un demi-cadratin entouré d’espaces fines insécables', () => {
    expect(formatTimeRange('14:00', '16:30')).toBe(
      `14${NBSP}h${NBSP}00${THIN}–${THIN}16${NBSP}h${NBSP}30`,
    );
  });

  it('écrit une durée en heures et minutes, en heures seules ou en minutes seules', () => {
    expect(formatDuration('14:00', '16:30')).toBe(`2${NBSP}h${NBSP}30`);
    expect(formatDuration('14:00', '16:00')).toBe(`2${NBSP}h`);
    expect(formatDuration('12:15', '13:00')).toBe(`45${NBSP}min`);
  });

  it('désigne un créneau par son rang, puis sa plage', () => {
    expect(timeSlotLabel({ rank: 2, start: '14:00', end: '16:30' })).toBe(
      `Créneau 2 · 14${NBSP}h${NBSP}00${THIN}–${THIN}16${NBSP}h${NBSP}30`,
    );
  });
});

describe('normalizeTime', () => {
  it.each([
    ['14:00', '14:00'],
    ['9:30', '09:30'],
    ['9', '09:00'],
    ['14h', '14:00'],
    ['14h30', '14:30'],
    [' 14 h 30 ', '14:30'],
    ['0:00', '00:00'],
    ['23:59', '23:59'],
  ])('lit « %s » comme %s, sur 24 heures', (text, time) => {
    expect(normalizeTime(text)).toBe(time);
  });

  it.each(['24:00', '12:60', '2 PM', '14:5', 'midi', ''])('refuse « %s »', (text) => {
    expect(normalizeTime(text)).toBeUndefined();
  });
});
