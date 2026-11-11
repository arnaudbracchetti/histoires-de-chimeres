import { describe, expect, it } from 'vitest';
import { ComparableName } from '../comparable-name.js';
import { Refusal } from '../refusal.js';
import { Password } from './password.js';

const kairos = ComparableName.createFromText('Kaïros');

function catchRefusal(action: () => void): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error('Aucun refus');
}

describe('Mot de passe du compte (ADR 0018)', () => {
  it('accepte de 10 à 128 caractères, espaces compris, sans règle de composition', () => {
    expect(Password.createForNickname('une phrase', kairos).text).toBe('une phrase');
    expect(Password.createForNickname('x'.repeat(128), kairos).text).toHaveLength(128);
  });

  it('refuse moins de 10 caractères', () => {
    const refusal = catchRefusal(() => Password.createForNickname('neuf car.', kairos));
    expect(refusal.code).toBe('password-too-short');
    expect(refusal.params).toEqual({ min: 10 });
  });

  it('compte les caractères, pas les unités UTF-16 : 9 émojis restent trop courts', () => {
    expect(catchRefusal(() => Password.createForNickname('🐉'.repeat(9), kairos)).code).toBe(
      'password-too-short',
    );
  });

  it('refuse plus de 128 caractères', () => {
    const refusal = catchRefusal(() => Password.createForNickname('x'.repeat(129), kairos));
    expect(refusal.code).toBe('password-too-long');
    expect(refusal.params).toEqual({ max: 128 });
  });

  it('refuse le pseudo, comparé comme ID-7 : casse, accents et espaces', () => {
    const longNickname = ComparableName.createFromText('Grand Kaïros Noir');
    expect(
      catchRefusal(() => Password.createForNickname('  grand  KAIROS noir ', longNickname)).code,
    ).toBe('password-is-nickname');
  });
});
