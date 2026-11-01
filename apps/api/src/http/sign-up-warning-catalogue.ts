import type { SignUpWarningCode, SignUpWarningDto, SignUpWarningParams } from '@chimeres/contract';
import type { SignUpWarning } from '@chimeres/domain';
import { countOf, fr } from '@chimeres/design';

type Text<P> = {
  /** En couleur, court : « Il manque 4 places ». */
  title: (params: P) => string;
  /** En gris, ce qui se passe : « 26 participants pour 22 places au plus. » */
  detail: (params: P) => string;
};

const participants = (count: number) => countOf(count, 'participant', 'participants');
const seats = (count: number) => countOf(count, 'place', 'places');
const gamesBelowMinimum = (count: number) =>
  `${countOf(count, 'partie', 'parties')} ${count > 1 ? 'sous leur minimum' : 'sous son minimum'}`;
const mayBeLeftWithoutTable = (count: number) =>
  count > 1
    ? fr`${participants(count)} risquent de rester sans table`
    : fr`${participants(count)} risque de rester sans table`;

/**
 * Les textes des avertissements de suivi d'un créneau, en français, un par code (ADR 0008), à côté
 * des messages des refus. Un code sans texte ne compile pas. Typographie de docs/design/ton.md :
 * espace insécable devant « : », et entre un nombre et son nom. Un nombre nul n'est jamais écrit
 * dans une énumération.
 */
export const signUpWarningCatalogue: {
  [C in SignUpWarningCode]: Text<SignUpWarningParams[C]>;
} = {
  'seats-missing': {
    title: ({ missingSeats }) => fr`Il manque ${seats(missingSeats)}`,
    detail: ({ demand, maxCapacity }) =>
      fr`${participants(demand)} pour ${seats(maxCapacity)} au plus.`,
  },
  'participants-may-not-be-placed': {
    title: ({ participants: count }) =>
      count > 1
        ? fr`${participants(count)} risquent de ne pas être placés`
        : fr`${participants(count)} risque de ne pas être placé`,
    detail: ({ participants: count }) =>
      count > 1
        ? fr`Toutes leurs parties du créneau sont très demandées.`
        : fr`Toutes ses parties du créneau sont très demandées.`,
  },
  'nearly-full': {
    title: () => fr`Presque plein`,
    detail: ({ demand, maxCapacity }) =>
      fr`${participants(demand)} pour ${seats(maxCapacity)} au plus.`,
  },
  'too-many-games': {
    title: () => fr`Trop de parties`,
    detail: (params) => {
      const shortfalls = [
        ...(params.gamesBelowMinimum > 0 ? [gamesBelowMinimum(params.gamesBelowMinimum)] : []),
        ...(params.participantsMayBeLeftWithoutTable > 0
          ? [mayBeLeftWithoutTable(params.participantsMayBeLeftWithoutTable)]
          : []),
      ];
      const reason = fr`${participants(params.demand)} pour ${seats(params.minCapacity)} au moins : une partie au moins finira sous son minimum.`;
      return shortfalls.length > 0 ? `${reason} ${shortfalls.join(', ')}.` : reason;
    },
  },
  'games-below-minimum': {
    title: ({ gamesBelowMinimum: count }) => gamesBelowMinimum(count),
    detail: ({ participantsMayBeLeftWithoutTable: count }) =>
      count > 0
        ? `${mayBeLeftWithoutTable(count)}.`
        : fr`Aucun participant ne risque de rester sans table.`,
  },
};

/** Un avertissement de suivi du domaine, avec son titre et son détail. */
export function writeSignUpWarning({ code, level, params }: SignUpWarning): SignUpWarningDto {
  const text = signUpWarningCatalogue[code] as Text<typeof params>;
  return { code, level, title: text.title(params), detail: text.detail(params) };
}
