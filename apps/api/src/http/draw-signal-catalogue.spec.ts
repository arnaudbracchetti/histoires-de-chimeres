import { NBSP } from '@chimeres/design';
import type { DrawSignal } from '@chimeres/domain';
import { writeDrawSignal } from './draw-signal-catalogue.js';

/** Le texte, avec des espaces ordinaires à la place des insécables, pour le relire. */
const plain = (text: string) => text.replaceAll(NBSP, ' ');

const TITLES = new Map([
  ['g1', 'Sous la surface'],
  ['g2', 'Néons'],
]);

const write = (signal: DrawSignal) => {
  const { title, detail } = writeDrawSignal(signal, (gameId) => TITLES.get(gameId)!);
  return [plain(title), plain(detail)];
};

describe('Textes des signaux du tirage', () => {
  it('dit les non placés au pluriel, ou qu’aucune place ne reste libre', () => {
    expect(
      write({
        code: 'participants-unassigned',
        level: 'danger',
        params: { unassignedCount: 7, freeSeatCount: 0 },
      }),
    ).toEqual(['7 non placés', 'Aucune place libre dans les parties du créneau.']);
  });

  it('accorde les parties sans joueur et sous leur minimum', () => {
    expect(
      write({ code: 'games-without-players', level: 'danger', params: { gameCount: 2 } }),
    ).toEqual(['2 parties sans joueur', 'Annule-les pour publier le tirage.']);
    expect(
      write({ code: 'games-below-minimum', level: 'warning', params: { gameCount: 2 } }),
    ).toEqual([
      '2 parties sous leur minimum',
      'Maintenues : elles seront jouées ainsi, sauf si tu les annules.',
    ]);
  });

  it('nomme chaque partie au-delà de son maximum, une après l’autre', () => {
    expect(
      write({
        code: 'games-over-maximum',
        level: 'warning',
        params: {
          games: [
            { gameId: 'g1', playerCount: 6, maxSeats: 5 },
            { gameId: 'g2', playerCount: 2, maxSeats: 1 },
          ],
        },
      }),
    ).toEqual([
      '2 parties au-delà de leur maximum',
      '« Sous la surface » : 6 joueurs pour 5 places. « Néons » : 2 joueurs pour 1 place.',
    ]);
  });
});
