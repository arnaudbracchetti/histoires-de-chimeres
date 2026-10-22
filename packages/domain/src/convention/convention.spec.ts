import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Convention } from './convention.js';

function aConvention(): Convention {
  return Convention.restore({ id: 'c1', name: 'Histoires de Chimères', date: null, version: 0 });
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

    convention.setDate('2027-03-14');
    convention.setDate('2027-03-21');

    expect(convention.date).toBe('2027-03-21');
  });

  it('efface sa date', () => {
    const convention = aConvention();
    convention.setDate('2027-03-14');

    convention.setDate(null);

    expect(convention.date).toBeNull();
  });
});
