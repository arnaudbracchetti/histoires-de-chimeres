import { describe, expect, it } from 'vitest';
import { formatConventionDate, formatDayAndMonth } from './date.js';

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

describe('formatDayAndMonth', () => {
  it('écrit le quantième et le mois, à l’heure locale', () => {
    expect(formatDayAndMonth(new Date(2027, 9, 26, 23, 30))).toBe('26 octobre');
  });

  it('écrit le premier du mois « 1er »', () => {
    expect(formatDayAndMonth(new Date(2027, 4, 1))).toBe('1er mai');
  });
});
