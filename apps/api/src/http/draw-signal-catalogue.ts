import type { DrawSignalCode, DrawSignalDto, DrawSignalParams } from '@chimeres/contract';
import type { DrawSignal } from '@chimeres/domain';
import { countOf, fr, plural } from '@chimeres/design';

/** Le titre du scénario d'une partie, que `games-over-maximum` nomme. */
type TitleOfGame = (gameId: string) => string;

type Text<P> = {
  /** En couleur, court : « 7 non placés ». */
  title: (params: P) => string;
  /** En gris, ce qui se passe : « Il reste 3 places dans les parties du créneau. » */
  detail: (params: P, titleOfGame: TitleOfGame) => string;
};

const seats = (count: number) => countOf(count, 'place', 'places');
const games = (count: number) => countOf(count, 'partie', 'parties');

/**
 * Les textes des signaux du tirage, en français, un par code (ADR 0008), à côté de ceux des
 * avertissements de suivi. Un code sans texte ne compile pas. Typographie de docs/design/ton.md :
 * espace insécable devant « : », et entre un nombre et son nom.
 */
export const drawSignalCatalogue: { [C in DrawSignalCode]: Text<DrawSignalParams[C]> } = {
  'participants-unassigned': {
    title: ({ unassignedCount }) => countOf(unassignedCount, 'non placé', 'non placés'),
    detail: ({ freeSeatCount }) =>
      freeSeatCount > 0
        ? fr`Il reste ${seats(freeSeatCount)} dans les parties du créneau.`
        : fr`Aucune place libre dans les parties du créneau.`,
  },
  'games-without-players': {
    title: ({ gameCount }) => fr`${games(gameCount)} sans joueur`,
    detail: ({ gameCount }) => fr`Annule-${plural(gameCount, 'la', 'les')} pour publier le tirage.`,
  },
  'games-below-minimum': {
    title: ({ gameCount }) =>
      fr`${games(gameCount)} sous ${plural(gameCount, 'son', 'leur')} minimum`,
    detail: ({ gameCount }) =>
      gameCount > 1
        ? fr`Maintenues : elles seront jouées ainsi, sauf si tu les annules.`
        : fr`Maintenue : elle sera jouée ainsi, sauf si tu l'annules.`,
  },
  'games-over-maximum': {
    title: ({ games: over }) =>
      fr`${games(over.length)} au-delà de ${plural(over.length, 'son', 'leur')} maximum`,
    detail: ({ games: over }, titleOfGame) =>
      over
        .map(
          ({ gameId, playerCount, maxSeats }) =>
            fr`« ${titleOfGame(gameId)} » : ${countOf(playerCount, 'joueur', 'joueurs')} pour ${seats(maxSeats)}.`,
        )
        .join(' '),
  },
};

/** Un signal du tirage du domaine, avec son titre et son détail. */
export function writeDrawSignal(
  { code, level, params }: DrawSignal,
  titleOfGame: TitleOfGame,
): DrawSignalDto {
  const text = drawSignalCatalogue[code] as Text<typeof params>;
  return { code, level, title: text.title(params), detail: text.detail(params, titleOfGame) };
}
