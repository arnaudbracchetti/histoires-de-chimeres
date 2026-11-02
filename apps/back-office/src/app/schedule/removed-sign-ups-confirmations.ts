import { computed, type Signal } from '@angular/core';
import type { GameDto, RemovedSignUpsDto } from '@chimeres/contract';
import { countOf, formatCount, formatTimeSlotRanks, fr, plural } from '@chimeres/design';
import type { ConfirmationRequest } from '../ui/confirmation';
import type { GridTimeSlot } from './grid-time-slot';

/** Les textes d'une confirmation, sans son écriture. */
export type ConfirmationTexts = Pick<
  ConfirmationRequest,
  'question' | 'consequences' | 'confirmLabel'
>;

/** Les chiffres des inscriptions d'une partie, sans son id. */
type SignUpFigures = Pick<RemovedSignUpsDto, 'signUpCount' | 'withoutOtherSignUpCount'>;

/**
 * Les chiffres à jour des inscriptions de chaque partie, lus dans un signal : sur la page de
 * pilotage, ceux du suivi relu. `undefined` pour une partie qu'ils ne connaissent plus : le dialogue
 * garde alors les chiffres lus au geste.
 */
export type CurrentSignUpFigures = (gameId: string) => SignUpFigures | undefined;

/**
 * La confirmation d'une déprogrammation qui retire des inscriptions (IN-6, NO-2) :
 * « Déprogrammer « Néons » du créneau 2 ? ».
 */
export function buildUnscheduleConfirmation(
  game: GameDto,
  removed: RemovedSignUpsDto,
  timeSlots: readonly GridTimeSlot[],
  current?: CurrentSignUpFigures,
): ConfirmationTexts {
  return {
    question: fr`Déprogrammer « ${game.scenario.title} » ${ofRanks(ranksOf(game.timeSlotIds, timeSlots))} ?`,
    consequences: followFigures(current, (figuresOf) => [
      ...describeRemovedSignUps(figuresOf(removed), theGame(game, timeSlots)),
      fr`Le scénario revient en réserve, sans ses inscriptions.`,
    ]),
    confirmLabel: 'Déprogrammer la partie',
  };
}

/**
 * La confirmation du déplacement de la partie sur la case de `timeSlotId`, ou de son échange avec
 * `otherGameId` (une partie du programme `games`), d'après les inscriptions que le verdict de la
 * case dit retirées ; `undefined` s'il n'en retire aucune : le geste s'écrit aussitôt. Avec
 * `current`, les chiffres du dialogue ouvert suivent ceux des mêmes parties.
 */
export function buildMoveOrSwapConfirmation(
  game: GameDto,
  timeSlotId: string,
  otherGameId: string | null,
  removed: readonly RemovedSignUpsDto[],
  games: readonly GameDto[],
  timeSlots: readonly GridTimeSlot[],
  current?: CurrentSignUpFigures,
): ConfirmationTexts | undefined {
  const [first] = removed;
  if (!first) return undefined;
  if (!otherGameId) return buildMoveConfirmation(game, timeSlotId, first, timeSlots, current);
  const other = games.find(({ id }) => id === otherGameId);
  return buildSwapConfirmation(game, other, removed, timeSlots, current);
}

/**
 * Les paragraphes que `describe` écrit des chiffres que lui donne `figuresOf` : ceux lus au geste, ou
 * avec `current` ceux, à jour, des mêmes parties, repris à chaque lecture du signal.
 */
function followFigures(
  current: CurrentSignUpFigures | undefined,
  describe: (figuresOf: (removed: RemovedSignUpsDto) => SignUpFigures) => string[],
): Signal<readonly string[]> {
  return computed(() => describe((removed) => current?.(removed.gameId) ?? removed));
}

/**
 * La confirmation d'un déplacement sur un autre créneau qui retire des inscriptions :
 * « Déplacer « Néons » sur le créneau 3 ? ». `timeSlotId` : son nouveau premier créneau.
 */
function buildMoveConfirmation(
  game: GameDto,
  timeSlotId: string,
  removed: RemovedSignUpsDto,
  timeSlots: readonly GridTimeSlot[],
  current: CurrentSignUpFigures | undefined,
): ConfirmationTexts {
  const first = timeSlots.findIndex(({ id }) => id === timeSlotId);
  const target = timeSlots.slice(first, first + game.timeSlotIds.length).map(({ rank }) => rank);
  return {
    question: fr`Déplacer « ${game.scenario.title} » ${onRanks(target)} ?`,
    consequences: followFigures(current, (figuresOf) =>
      describeRemovedSignUps(figuresOf(removed), theGame(game, timeSlots)),
    ),
    confirmLabel: 'Déplacer la partie',
  };
}

/**
 * La confirmation d'un échange entre deux créneaux qui retire des inscriptions : les phrases de
 * chaque partie touchée, « Il y a 12 inscrits à « Néons » (créneau 2). ». `other` manque si le
 * programme lu ne la connaît plus : la question ne nomme alors que la partie déplacée.
 */
function buildSwapConfirmation(
  game: GameDto,
  other: GameDto | undefined,
  removed: readonly RemovedSignUpsDto[],
  timeSlots: readonly GridTimeSlot[],
  current: CurrentSignUpFigures | undefined,
): ConfirmationTexts {
  return {
    question: other
      ? fr`Échanger « ${game.scenario.title} » et « ${other.scenario.title} » ?`
      : fr`Échanger « ${game.scenario.title} » avec l'autre partie ?`,
    consequences: followFigures(current, (figuresOf) =>
      removed.flatMap((each) => {
        const touched = [game, other].find((candidate) => candidate?.id === each.gameId);
        if (!touched) return describeRemovedSignUps(figuresOf(each), "l'autre partie");
        const ranks = formatTimeSlotRanks(ranksOf(touched.timeSlotIds, timeSlots));
        return describeNamedGameRemovedSignUps(
          figuresOf(each),
          fr`« ${touched.scenario.title} » (${ranks})`,
        );
      }),
    ),
    confirmLabel: 'Échanger les parties',
  };
}

/**
 * Deux paragraphes : « Il y a 12 inscrits à la partie. Ils perdront leur inscription et seront
 * notifiés. », puis « 3 d'entre eux n'ont pas d'autre inscription sur le créneau : ils restent
 * dans le tirage du créneau, mais sans être inscrits à aucune partie. » (IN-6), au singulier pour
 * un inscrit. `target` suit « à » : « la partie », « « Néons » (créneau 2) ». Un nombre nul ne
 * s'écrit pas : le second paragraphe manque. Le domaine ne liste pas une partie sans inscrit, mais
 * leur nombre peut retomber à 0 dans un dialogue ouvert : « Aucun inscrit ne perd son
 * inscription. ».
 */
function describeRemovedSignUps(figures: SignUpFigures, target: string): string[] {
  if (!figures.signUpCount) return [fr`Aucun inscrit ne perd son inscription.`];
  return describeSignUpsToRemove(figures, target);
}

/**
 * Les paragraphes de `describeRemovedSignUps()` pour une partie parmi deux, nommée par `target` :
 * à 0 inscrit, la phrase la nomme aussi, « Aucun inscrit de « Néons » (créneau 2) ne perd son
 * inscription. ».
 */
function describeNamedGameRemovedSignUps(figures: SignUpFigures, target: string): string[] {
  if (!figures.signUpCount) return [fr`Aucun inscrit de ${target} ne perd son inscription.`];
  return describeSignUpsToRemove(figures, target);
}

/** Les paragraphes de `describeRemovedSignUps()` quand la partie a au moins un inscrit. */
function describeSignUpsToRemove(
  { signUpCount, withoutOtherSignUpCount }: SignUpFigures,
  target: string,
): string[] {
  const signedUp = fr`Il y a ${countOf(signUpCount, 'inscrit', 'inscrits')} à ${target}.`;
  if (signUpCount === 1) {
    return [
      fr`${signedUp} Il perdra son inscription et sera notifié.`,
      ...(withoutOtherSignUpCount
        ? [
            fr`C'est sa seule inscription sur le créneau : il reste dans le tirage du créneau, mais sans être inscrit à aucune partie.`,
          ]
        : []),
    ];
  }
  const without = withoutOtherSignUpCount
    ? [
        fr`${formatCount(withoutOtherSignUpCount)} d'entre eux ${plural(withoutOtherSignUpCount, "n'a", "n'ont")} pas d'autre inscription sur le créneau : ${plural(withoutOtherSignUpCount, 'il reste', 'ils restent')} dans le tirage du créneau, mais sans être ${plural(withoutOtherSignUpCount, 'inscrit', 'inscrits')} à aucune partie.`,
      ]
    : [];
  return [fr`${signedUp} Ils perdront leur inscription et seront notifiés.`, ...without];
}

/** « la partie », ou « la partie (créneaux 2 et 3) » pour une partie double. */
function theGame(game: GameDto, timeSlots: readonly GridTimeSlot[]): string {
  const ranks = ranksOf(game.timeSlotIds, timeSlots);
  return ranks.length > 1 ? `la partie (${formatTimeSlotRanks(ranks)})` : 'la partie';
}

function ranksOf(timeSlotIds: readonly string[], timeSlots: readonly GridTimeSlot[]): number[] {
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
