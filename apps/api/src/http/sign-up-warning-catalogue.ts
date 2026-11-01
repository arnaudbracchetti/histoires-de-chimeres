import type { SignUpWarningCode, SignUpWarningDto, SignUpWarningParams } from '@chimeres/contract';
import type { SignUpWarning } from '@chimeres/domain';
import { countOf, fr, plural } from '@chimeres/design';

type Text<P> = {
  /** En couleur, court : « Il manque 4 places ». */
  title: (params: P) => string;
  /** En gris, ce qui se passe : « 26 participants pour 22 places au plus. » */
  detail: (params: P) => string;
};

const participants = (count: number) => countOf(count, 'participant', 'participants');
const seats = (count: number) => countOf(count, 'place', 'places');
const gamesBelowMinimum = (count: number) =>
  fr`${countOf(count, 'partie', 'parties')} sous ${plural(count, 'son', 'leur')} minimum`;
const mayBeLeftWithoutTable = (count: number) =>
  fr`${participants(count)} ${plural(count, 'risque', 'risquent')} de rester sans table`;

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
    title: ({ participantCount }) =>
      fr`${participants(participantCount)} ${plural(participantCount, 'risque', 'risquent')} de ne pas être ${plural(participantCount, 'placé', 'placés')}`,
    detail: ({ participantCount }) =>
      fr`Toutes ${plural(participantCount, 'ses', 'leurs')} parties du créneau sont très demandées.`,
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
      return shortfalls.length > 0 ? fr`${reason} ${shortfalls.join(', ')}.` : reason;
    },
  },
  'games-below-minimum': {
    title: ({ gamesBelowMinimum: count }) => gamesBelowMinimum(count),
    detail: ({ participantsMayBeLeftWithoutTable: count }) =>
      count > 0
        ? fr`${mayBeLeftWithoutTable(count)}.`
        : fr`Aucun participant ne risque de rester sans table.`,
  },
};

/** Un avertissement de suivi du domaine, avec son titre et son détail. */
export function writeSignUpWarning({ code, level, params }: SignUpWarning): SignUpWarningDto {
  const text = signUpWarningCatalogue[code] as Text<typeof params>;
  return { code, level, title: text.title(params), detail: text.detail(params) };
}
