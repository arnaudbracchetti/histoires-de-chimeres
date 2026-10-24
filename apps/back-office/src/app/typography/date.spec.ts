import { formatConventionDate } from './date';

describe('formatConventionDate', () => {
  it('écrit le jour, le quantième, le mois et l’année', () => {
    expect(formatConventionDate('2027-03-13')).toBe('samedi 13 mars 2027');
  });

  it('écrit le premier du mois « 1er »', () => {
    expect(formatConventionDate('2027-05-01')).toBe('samedi 1er mai 2027');
  });

  it('écrit « date à fixer » sans date', () => {
    expect(formatConventionDate(null)).toBe('date à fixer');
  });
});
