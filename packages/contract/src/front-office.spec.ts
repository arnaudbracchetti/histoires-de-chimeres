import { describe, expect, it } from 'vitest';
import { buildFrontOfficeUrl, PRESENCE_CODE_PARAM } from './front-office.js';

describe('buildFrontOfficeUrl', () => {
  it('ouvre le front office de l’origine avec le code de présence', () => {
    expect(buildFrontOfficeUrl('https://chimeres.example.org', 'K7M2')).toBe(
      `https://chimeres.example.org/?${PRESENCE_CODE_PARAM}=K7M2`,
    );
  });

  it('garde le port de l’origine', () => {
    expect(buildFrontOfficeUrl('http://localhost:8081', 'AB12')).toBe(
      `http://localhost:8081/?${PRESENCE_CODE_PARAM}=AB12`,
    );
  });
});
