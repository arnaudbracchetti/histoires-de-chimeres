import { describe, expect, it } from 'vitest';
import {
  CONTENT_WARNINGS_MAX_LENGTH,
  CONVENTION_NAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  PRESENTATION_MAX_LENGTH,
  SCENARIO_TITLE_MAX_LENGTH,
  SYSTEM_MAX_LENGTH,
  TABLE_NAME_MAX_LENGTH,
} from '@chimeres/contract';
import { ContentWarnings, Convention, Scenario } from '@chimeres/domain';

describe('Bornes du contrat et du domaine', () => {
  it('le nom de la convention a la même longueur maximale', () => {
    expect(CONVENTION_NAME_MAX_LENGTH).toBe(Convention.NAME_MAX_LENGTH);
  });

  it('le nom d’une table a la même longueur maximale', () => {
    expect(TABLE_NAME_MAX_LENGTH).toBe(Convention.TABLE_NAME_MAX_LENGTH);
  });

  it('le pseudo d’un MJ a la même longueur maximale', () => {
    expect(NICKNAME_MAX_LENGTH).toBe(Convention.NICKNAME_MAX_LENGTH);
  });

  it('le contenu d’un scénario a les mêmes longueurs maximales', () => {
    expect(SCENARIO_TITLE_MAX_LENGTH).toBe(Scenario.TITLE_MAX_LENGTH);
    expect(SYSTEM_MAX_LENGTH).toBe(Scenario.SYSTEM_MAX_LENGTH);
    expect(PRESENTATION_MAX_LENGTH).toBe(Scenario.PRESENTATION_MAX_LENGTH);
    expect(CONTENT_WARNINGS_MAX_LENGTH).toBe(ContentWarnings.MAX_LENGTH);
  });
});
