import { describe, expect, it } from 'vitest';
import { NBSP } from './french.js';
import { formatConventionDate, formatDayAndMonth, formatLocalMoment } from './date.js';

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

describe('formatLocalMoment', () => {
  it("écrit le jour, le quantième, le mois et l'heure, sans l'année", () => {
    expect(formatLocalMoment({ date: '2027-03-21', time: '09:30' })).toBe(
      `dimanche 21 mars à 9${NBSP}h${NBSP}30`,
    );
  });

  it('écrit le premier du mois « 1er »', () => {
    expect(formatLocalMoment({ date: '2027-05-01', time: '14:00' })).toBe(
      `samedi 1er mai à 14${NBSP}h${NBSP}00`,
    );
  });
});
