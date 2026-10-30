import { TimeOfDay } from '@chimeres/domain';
import { instantOfParisMoment, parisMomentOf } from './paris-clock.js';

/** Le moment parisien, en `AAAA-MM-JJ HH:MM`. */
const moment = (instant: string) => {
  const { date, time } = parisMomentOf(new Date(instant));
  return `${date} ${time.toString()}`;
};

describe('Heure de Paris', () => {
  it('ajoute une heure en hiver', () => {
    expect(moment('2027-03-14T08:30:00Z')).toBe('2027-03-14 09:30');
  });

  it('ajoute deux heures en été', () => {
    expect(moment('2027-07-14T08:30:00Z')).toBe('2027-07-14 10:30');
  });

  it('passe au lendemain avant minuit en temps universel', () => {
    expect(moment('2027-03-14T23:15:00Z')).toBe('2027-03-15 00:15');
  });
});

describe('Instant d’un moment parisien', () => {
  const instant = (date: string, time: string) =>
    instantOfParisMoment({ date, time: TimeOfDay.parse(time) }).toISOString();

  it('retire une heure en hiver', () => {
    expect(instant('2027-03-14', '09:30')).toBe('2027-03-14T08:30:00.000Z');
  });

  it('retire deux heures en été', () => {
    expect(instant('2027-07-14', '10:30')).toBe('2027-07-14T08:30:00.000Z');
  });

  it('passe à la veille juste après minuit', () => {
    expect(instant('2027-03-15', '00:15')).toBe('2027-03-14T23:15:00.000Z');
  });

  it('suit le passage à l’heure d’été, le jour même', () => {
    expect(instant('2027-03-28', '01:30')).toBe('2027-03-28T00:30:00.000Z');
    expect(instant('2027-03-28', '03:30')).toBe('2027-03-28T01:30:00.000Z');
  });
});
