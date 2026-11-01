import { NBSP } from '@chimeres/design';
import { writeSignUpWarning } from './sign-up-warning-catalogue.js';

/** Le texte, avec des espaces ordinaires à la place des insécables, pour le relire. */
const plain = (text: string) => text.replaceAll(NBSP, ' ');

describe('Textes des avertissements de suivi', () => {
  it('écrit chaque titre et chaque détail avec les espaces de la typographie française', () => {
    const { title, detail } = writeSignUpWarning({
      code: 'too-many-games',
      level: 'warning',
      params: {
        demand: 2,
        minCapacity: 9,
        gamesBelowMinimum: 3,
        participantsMayBeLeftWithoutTable: 2,
      },
    });

    for (const text of [title, detail]) expect(text).not.toMatch(/ [:;!?»]|« |\d [a-z]/);
  });

  it('dit au singulier la place qui manque', () => {
    const { title, detail } = writeSignUpWarning({
      code: 'seats-missing',
      level: 'danger',
      params: { demand: 23, maxCapacity: 22, missingSeats: 1 },
    });

    expect([plain(title), plain(detail)]).toEqual([
      'Il manque 1 place',
      '23 participants pour 22 places au plus.',
    ]);
  });

  it('dit au singulier le participant qui risque de ne pas être placé', () => {
    const { title, detail } = writeSignUpWarning({
      code: 'participants-may-not-be-placed',
      level: 'danger',
      params: { participants: 1 },
    });

    expect([plain(title), detail]).toEqual([
      '1 participant risque de ne pas être placé',
      'Toutes ses parties du créneau sont très demandées.',
    ]);
  });

  it('dit « presque plein » avec la demande et la capacité maximum', () => {
    const { title, detail } = writeSignUpWarning({
      code: 'nearly-full',
      level: 'warning',
      params: { demand: 19, maxCapacity: 22 },
    });

    expect([title, plain(detail)]).toEqual([
      'Presque plein',
      '19 participants pour 22 places au plus.',
    ]);
  });

  it('n’écrit aucun nombre nul dans l’énumération de « trop de parties »', () => {
    const detail = (gamesBelowMinimum: number, participantsMayBeLeftWithoutTable: number) =>
      plain(
        writeSignUpWarning({
          code: 'too-many-games',
          level: 'warning',
          params: {
            demand: 2,
            minCapacity: 9,
            gamesBelowMinimum,
            participantsMayBeLeftWithoutTable,
          },
        }).detail,
      );
    const reason =
      '2 participants pour 9 places au moins : une partie au moins finira sous son minimum.';

    expect(detail(3, 2)).toBe(
      `${reason} 3 parties sous leur minimum, 2 participants risquent de rester sans table.`,
    );
    expect(detail(1, 0)).toBe(`${reason} 1 partie sous son minimum.`);
    expect(detail(0, 1)).toBe(`${reason} 1 participant risque de rester sans table.`);
    expect(detail(0, 0)).toBe(reason);
  });

  it('dit combien de parties sont sous leur minimum, et qui risque de rester sans table', () => {
    const write = (gamesBelowMinimum: number, participantsMayBeLeftWithoutTable: number) => {
      const { title, detail } = writeSignUpWarning({
        code: 'games-below-minimum',
        level: 'warning',
        params: {
          demand: 12,
          minCapacity: 9,
          gamesBelowMinimum,
          participantsMayBeLeftWithoutTable,
        },
      });
      return [plain(title), plain(detail)];
    };

    expect(write(3, 2)).toEqual([
      '3 parties sous leur minimum',
      '2 participants risquent de rester sans table.',
    ]);
    expect(write(1, 0)).toEqual([
      '1 partie sous son minimum',
      'Aucun participant ne risque de rester sans table.',
    ]);
  });
});
