// La journée de la convention du test (docs/load-test/plan.md § 5).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeConventionDay } from './convention-plan.ts';

describe('La journée de la convention du test', () => {
  it('commence le créneau mesuré une heure après le lancement, avec des créneaux de 2 h', () => {
    // 9 h 02 à Paris, en novembre (UTC+1).
    const day = computeConventionDay(new Date('2026-11-15T08:02:00Z'));
    assert.equal(day.date, '2026-11-15');
    assert.deepEqual(day.hours, [
      { start: '10:05', end: '12:05' },
      { start: '12:05', end: '14:05' },
      { start: '14:05', end: '16:05' },
      { start: '16:05', end: '18:05' },
      { start: '18:05', end: '20:05' },
    ]);
  });

  it('raccourcit les créneaux le soir, sans reculer le créneau mesuré', () => {
    // 18 h 17 à Paris : le créneau mesuré reste une heure après, et la journée finit à 23 h 55.
    const day = computeConventionDay(new Date('2026-11-15T17:17:00Z'));
    assert.deepEqual(day.hours, [
      { start: '19:20', end: '20:15' },
      { start: '20:15', end: '21:10' },
      { start: '21:10', end: '22:05' },
      { start: '22:05', end: '23:00' },
      { start: '23:00', end: '23:55' },
    ]);
  });

  it('refuse un lancement trop tard pour des créneaux de 30 min', () => {
    // 20 h 30 à Paris : il resterait moins de 2 h 30 entre 21 h 30 et 23 h 55.
    assert.throws(() => computeConventionDay(new Date('2026-11-15T19:30:00Z')), /trop tard/);
  });
});
