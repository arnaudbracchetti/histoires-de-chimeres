import { describe, expect, it } from 'vitest';
import { PresenceCode } from './presence-code.js';

describe('PresenceCode (ID-2)', () => {
  it.each(['K7M2', 'k7m2', 'K7m2', '  K7M2 '])(
    '« K7M2 » accepte « %s » : la casse et les espaces autour ne comptent pas',
    (presented) => {
      expect(PresenceCode.of('K7M2').matches(presented)).toBe(true);
    },
  );

  it.each(['K7M3', 'K7M', 'K7M2Q', 'K7 M2', ''])('« K7M2 » refuse « %s »', (presented) => {
    expect(PresenceCode.of('K7M2').matches(presented)).toBe(false);
  });

  it.each([
    ['trop court', 'K7M'],
    ['trop long', 'K7M2Q'],
    ['avec un 0', 'K7M0'],
    ['avec un O', 'K7MO'],
    ['avec un 1', 'K7M1'],
    ['avec un I', 'K7MI'],
    ['avec un L', 'K7ML'],
    ['en minuscules', 'k7m2'],
  ])('ne se restaure pas %s : la base ne tient que des codes bien formés', (_, text) => {
    expect(() => PresenceCode.of(text)).toThrow(RangeError);
  });

  it('garde son texte, pour le back office et le QR code', () => {
    expect(PresenceCode.of('K7M2').text).toBe('K7M2');
  });
});
