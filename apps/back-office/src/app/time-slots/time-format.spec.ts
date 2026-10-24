import { normalizeTime } from './time-format';

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
