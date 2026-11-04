import type { FrontOfficeGameDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { counterOf } from './game-text';

const game = (figures: Partial<FrontOfficeGameDto>): FrontOfficeGameDto => ({
  id: 'p1',
  timeSlotIds: ['s1'],
  tableName: 'Dragon',
  title: 'Brumes',
  system: 'Cthulhu',
  gameMasterNickname: 'Kaïros',
  imageUrl: null,
  presentation: '',
  contentWarnings: '',
  seats: { min: 3, max: 5 },
  signUpCount: 7,
  playerCount: null,
  oversubscribed: true,
  ...figures,
});

describe('Compteur d’une partie (§5.3)', () => {
  it('compte les inscrits avant la publication', () => {
    expect(counterOf(game({}))).toBe(`7${NBSP}inscrits · 5${NBSP}places`);
  });

  it('compte les joueurs après la publication', () => {
    expect(counterOf(game({ playerCount: 4 }))).toBe(`4${NBSP}joueurs · 5${NBSP}places`);
  });
});
