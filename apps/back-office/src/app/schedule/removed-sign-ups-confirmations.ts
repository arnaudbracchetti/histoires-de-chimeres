import type { GameDto, RemovedSignUpsDto, TimeSlotDto } from '@chimeres/contract';
import { countOf, formatCount, formatTimeSlotRanks, fr, plural } from '@chimeres/design';
import type { ConfirmationRequest } from '../ui/confirmation';

/** Les textes d'une confirmation, sans son écriture. */
export type ConfirmationTexts = Pick<
  ConfirmationRequest,
  'question' | 'consequences' | 'confirmLabel'
>;

/**
 * La confirmation d'une déprogrammation qui retire des inscriptions (IN-6, NO-2) :
 * « Déprogrammer « Néons » du créneau 2 ? ».
 */
export function buildUnscheduleConfirmation(
  game: GameDto,
  removed: RemovedSignUpsDto,
  timeSlots: readonly TimeSlotDto[],
): ConfirmationTexts {
  return {
    question: fr`Déprogrammer « ${game.scenario.title} » ${ofRanks(ranksOf(game.timeSlotIds, timeSlots))} ?`,
    consequences: [
      ...describeRemovedSignUps(removed, theGame(game, timeSlots)),
      fr`Le scénario revient en réserve, sans ses inscriptions.`,
    ],
    confirmLabel: 'Déprogrammer la partie',
  };
}

/**
 * La confirmation d'un déplacement sur un autre créneau qui retire des inscriptions :
 * « Déplacer « Néons » sur le créneau 3 ? ». `timeSlotId` : son nouveau premier créneau.
 */
export function buildMoveConfirmation(
  game: GameDto,
  timeSlotId: string,
  removed: RemovedSignUpsDto,
  timeSlots: readonly TimeSlotDto[],
): ConfirmationTexts {
  const first = timeSlots.findIndex(({ id }) => id === timeSlotId);
  const target = timeSlots.slice(first, first + game.timeSlotIds.length).map(({ rank }) => rank);
  return {
    question: fr`Déplacer « ${game.scenario.title} » ${onRanks(target)} ?`,
    consequences: describeRemovedSignUps(removed, theGame(game, timeSlots)),
    confirmLabel: 'Déplacer la partie',
  };
}

/**
 * La confirmation d'un échange entre deux créneaux qui retire des inscriptions : les phrases de
 * chaque partie touchée, « Il y a 12 inscrits à « Néons » (créneau 2). ». `other` manque si le
 * programme lu ne la connaît plus : la question ne nomme alors que la partie déplacée.
 */
export function buildSwapConfirmation(
  game: GameDto,
  other: GameDto | undefined,
  removed: readonly RemovedSignUpsDto[],
  timeSlots: readonly TimeSlotDto[],
): ConfirmationTexts {
  return {
    question: other
      ? fr`Échanger « ${game.scenario.title} » et « ${other.scenario.title} » ?`
      : fr`Échanger « ${game.scenario.title} » avec l'autre partie ?`,
    consequences: removed.flatMap((each) => {
      const touched = [game, other].find((candidate) => candidate?.id === each.gameId);
      if (!touched) return describeRemovedSignUps(each, "l'autre partie");
      const ranks = formatTimeSlotRanks(ranksOf(touched.timeSlotIds, timeSlots));
      return describeRemovedSignUps(each, fr`« ${touched.scenario.title} » (${ranks})`);
    }),
    confirmLabel: 'Échanger les parties',
  };
}

/**
 * Deux paragraphes : « Il y a 12 inscrits à la partie. Ils perdront leur inscription et seront
 * notifiés. », puis « 3 d'entre eux n'ont pas d'autre inscription sur le créneau. », au singulier
 * pour un inscrit. `target` suit « à » : « la partie », « « Néons » (créneau 2) ». Un nombre nul ne
 * s'écrit pas : le second paragraphe manque, et le domaine ne liste pas une partie sans inscrit.
 */
function describeRemovedSignUps(
  { signUpCount, withoutOtherSignUpCount }: RemovedSignUpsDto,
  target: string,
): string[] {
  const signedUp = fr`Il y a ${countOf(signUpCount, 'inscrit', 'inscrits')} à ${target}.`;
  if (signUpCount === 1) {
    return [
      fr`${signedUp} Il perdra son inscription et sera notifié.`,
      ...(withoutOtherSignUpCount ? [fr`C'est sa seule inscription sur le créneau.`] : []),
    ];
  }
  const without = withoutOtherSignUpCount
    ? [
        fr`${formatCount(withoutOtherSignUpCount)} d'entre eux ${plural(withoutOtherSignUpCount, "n'a", "n'ont")} pas d'autre inscription sur le créneau.`,
      ]
    : [];
  return [fr`${signedUp} Ils perdront leur inscription et seront notifiés.`, ...without];
}

/** « la partie », ou « la partie (créneaux 2 et 3) » pour une partie double. */
function theGame(game: GameDto, timeSlots: readonly TimeSlotDto[]): string {
  const ranks = ranksOf(game.timeSlotIds, timeSlots);
  return ranks.length > 1 ? `la partie (${formatTimeSlotRanks(ranks)})` : 'la partie';
}

function ranksOf(timeSlotIds: readonly string[], timeSlots: readonly TimeSlotDto[]): number[] {
  return timeSlotIds.flatMap((slotId) => timeSlots.find(({ id }) => id === slotId)?.rank ?? []);
}

/** « du créneau 2 », « des créneaux 2 et 3 ». */
function ofRanks(ranks: readonly number[]): string {
  return `${ranks.length > 1 ? 'des' : 'du'} ${formatTimeSlotRanks(ranks)}`;
}

/** « sur le créneau 3 », « sur les créneaux 3 et 4 ». */
function onRanks(ranks: readonly number[]): string {
  return `sur ${ranks.length > 1 ? 'les' : 'le'} ${formatTimeSlotRanks(ranks)}`;
}
