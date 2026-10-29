import { parisMomentOf } from './paris-clock.js';

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
