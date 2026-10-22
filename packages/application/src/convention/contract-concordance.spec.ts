import { describe, expect, it } from 'vitest';
import { CONVENTION_NAME_MAX_LENGTH } from '@chimeres/contract';
import { Convention } from '@chimeres/domain';

describe('Bornes du contrat et du domaine', () => {
  it('le nom de la convention a la même longueur maximale', () => {
    expect(CONVENTION_NAME_MAX_LENGTH).toBe(Convention.NAME_MAX_LENGTH);
  });
});
