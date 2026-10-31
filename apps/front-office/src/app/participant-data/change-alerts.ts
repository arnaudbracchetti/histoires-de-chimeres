import {
  frontOfficeUrls,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
  type ParticipantSituationDto,
} from '@chimeres/contract';
import {
  buildAssignedText,
  buildCancelledText,
  buildGameMovedText,
  buildGameUnscheduledText,
  buildLeadingText,
  buildOwnGameScheduledText,
  buildOwnGameUnscheduledText,
  buildUnassignedText,
  type ChangeText,
} from '@chimeres/design';
import { gamesWithSeatsOn, ranksOf, tableNamesOf, timeSlotsOf } from '../game/game-text';
import type { ChangeNotice } from '../shell/alerts';

/** Une lecture réussie : le programme et la situation du pseudo. */
export type Reading = { schedule: FrontOfficeScheduleDto; situation: ParticipantSituationDto };

/**
 * Ce qui a changé pour le participant d'une lecture à la suivante, sans geste de sa part (NO-5) :
 * `ownWithdrawals`, les parties dont il s'est lui-même désinscrit. Les textes sont ceux des
 * notifications de NO-2, communs avec l'API.
 */
export function changesBetween(
  before: Reading,
  after: Reading,
  ownWithdrawals: readonly string[],
): ChangeNotice[] {
  return [
    ...publishedDraws(before, after),
    ...removedSignUps(before, after, ownWithdrawals),
    ...ledGameChanges(before, after),
  ];
}

/**
 * Les tirages publiés qui le concernent : sa table, pas de place, ou pour un MJ, ses joueurs ou sa
 * partie annulée. Une partie double a son résultat sur son seul premier créneau (TI-3).
 */
function publishedDraws(before: Reading, after: Reading): ChangeNotice[] {
  const { schedule } = after;
  const see = frontOfficeUrls.home();
  return after.situation.timeSlots.flatMap(({ timeSlotId, state, drawResult, ledGameId }) => {
    const previous = before.situation.timeSlots.find((slot) => slot.timeSlotId === timeSlotId);
    if (state !== 'published' || !drawResult || previous?.state === 'published') return [];
    const tablesWithSeats = tableNamesOf(gamesWithSeatsOn(timeSlotId, schedule));
    if (drawResult.kind === 'unassigned') {
      const rank = schedule.timeSlots.find(({ id }) => id === timeSlotId)?.rank ?? 0;
      return [buildChangeNotice(buildUnassignedText(rank, tablesWithSeats), see)];
    }
    const game = findGame(schedule, drawResult.kind === 'assigned' ? drawResult.gameId : ledGameId);
    if (!game) return [];
    const ranks = ranksOf(schedule, game);
    const text =
      drawResult.kind === 'assigned'
        ? buildAssignedText(ranks, game)
        : drawResult.kind === 'leading'
          ? buildLeadingText(ranks, game, drawResult.players.length)
          : buildCancelledText(ranks, game.title, tablesWithSeats);
    return [buildChangeNotice(text, see)];
  });
}

/**
 * Pour un MJ, ses parties à mener ajoutées ou retirées. Une partie déplacée sur un autre créneau
 * est signalée une fois, comme ajoutée sur ses nouveaux créneaux ; un changement de table, non.
 */
function ledGameChanges(before: Reading, after: Reading): ChangeNotice[] {
  const ledBefore = ledGames(before);
  const ledAfter = ledGames(after);
  const added = [...ledAfter]
    .filter(([gameId, first]) => ledBefore.get(gameId) !== first)
    .flatMap(([gameId]) => {
      const game = findGame(after.schedule, gameId);
      if (!game) return [];
      const slots = timeSlotsOf(after.schedule, game);
      const ranks = slots.map(({ rank }) => rank);
      const text = buildOwnGameScheduledText(ranks, game, slots[0]!.start, slots.at(-1)!.end);
      return [buildChangeNotice(text, frontOfficeUrls.myGamesOnTimeSlot(ranks[0]!))];
    });
  const removed = [...ledBefore.keys()]
    .filter((gameId) => !ledAfter.has(gameId))
    .flatMap((gameId) => {
      const game = findGame(before.schedule, gameId);
      if (!game) return [];
      const ranks = ranksOf(before.schedule, game);
      return [
        buildChangeNotice(
          buildOwnGameUnscheduledText(ranks, game.title),
          frontOfficeUrls.timeSlotGames(ranks[0]!),
        ),
      ];
    });
  return [...added, ...removed];
}

/** Les parties que mène le MJ du pseudo, chacune avec son premier créneau. */
function ledGames({ situation }: Reading): Map<string, string> {
  const led = new Map<string, string>();
  for (const { timeSlotId, ledGameId } of situation.timeSlots) {
    if (ledGameId && !led.has(ledGameId)) led.set(ledGameId, timeSlotId);
  }
  return led;
}

/**
 * Ses inscriptions retirées, sauf par lui : sa partie retirée du programme, ou déplacée sur
 * d'autres créneaux (IN-6). Une partie restée en place ne compte plus pour lui quand son MJ mène
 * sur l'un de ses créneaux, mais l'inscription reste, suspendue (IN-4) : rien à signaler.
 */
function removedSignUps(
  before: Reading,
  after: Reading,
  ownWithdrawals: readonly string[],
): ChangeNotice[] {
  return before.situation.signedUpGameIds
    .filter(
      (gameId) =>
        !after.situation.signedUpGameIds.includes(gameId) && !ownWithdrawals.includes(gameId),
    )
    .flatMap((gameId) => {
      const game = findGame(before.schedule, gameId);
      if (!game) return [];
      const ranks = ranksOf(before.schedule, game);
      const see = frontOfficeUrls.timeSlotGames(ranks[0]!);
      const moved = findGame(after.schedule, gameId);
      if (!moved) return [buildChangeNotice(buildGameUnscheduledText(ranks, game.title), see)];
      if (moved.timeSlotIds.join() === game.timeSlotIds.join()) return [];
      const text = buildGameMovedText(ranks, ranksOf(after.schedule, moved), game.title);
      return [buildChangeNotice(text, see)];
    });
}

function findGame(
  schedule: FrontOfficeScheduleDto,
  gameId: string | null,
): FrontOfficeGameDto | undefined {
  return schedule.games.find(({ id }) => id === gameId);
}

/** L'alerte d'un changement : le titre et le corps de sa notification, et ce que « Voir » ouvre. */
function buildChangeNotice({ title, body }: ChangeText, see: string): ChangeNotice {
  return { title, detail: body, see };
}
