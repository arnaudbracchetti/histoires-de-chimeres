import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Day } from './day.js';
import type { GameMaster } from './game-master.js';
import type { Schedule } from './schedule.js';
import type { UniquelyNamedCollection } from './uniquely-named-collection.js';

/**
 * La place d'un scénario dans la réserve : sur chaque créneau, dans l'ordre de la journée, s'il y
 * est en réserve et s'il y est programmé. Les deux s'excluent : son MJ y mènerait déjà une partie.
 * `unschedulable` : le refus qui explique pourquoi il n'est ni en réserve ni programmé nulle part,
 * ou `null`.
 */
export type ReserveOfScenario = {
  scenarioId: string;
  timeSlots: { timeSlotId: string; inReserve: boolean; scheduled: boolean }[];
  unschedulable: Refusal | null;
};

/**
 * La réserve (PR-6). Pour chaque scénario du catalogue, et pour chaque créneau, dit :
 * - s'il est en réserve sur ce créneau : son MJ y est disponible et n'y mène pas déjà une partie,
 *   sur ce créneau et le suivant pour un scénario double. Peu importe qu'il soit déjà programmé
 *   sur un autre créneau, ou qu'une table soit libre ;
 * - s'il y est programmé : une partie double l'est sur ses deux créneaux.
 * Un scénario ni en réserve ni programmé nulle part donne la raison dans `unschedulable`.
 * Les scénarios suivent l'ordre du catalogue.
 */
export function reserveOfEachScenario(
  catalogue: ScenarioCatalogue,
  day: Day,
  schedule: Schedule,
  gameMasters: UniquelyNamedCollection<GameMaster>,
): ReserveOfScenario[] {
  return catalogue.entries().map((entry) => {
    const gameMaster = gameMasters.existingItem(entry.gameMasterId);
    const timeSlots = day.timeSlots.map((slot) => ({
      timeSlotId: slot.id,
      inReserve: isAvailableAndFreeFrom(gameMaster, slot.id, entry.duration, day, schedule),
      scheduled: schedule.isScenarioScheduledOnTimeSlot(entry.id, slot.id),
    }));
    return {
      scenarioId: entry.id,
      timeSlots,
      unschedulable: timeSlots.some(({ inReserve, scheduled }) => inReserve || scheduled)
        ? null
        : unschedulableRefusalOf(gameMaster, entry.duration, day),
    };
  });
}

/**
 * Le MJ est disponible et ne mène aucune partie sur les `length` créneaux consécutifs à partir de
 * `timeSlotId`, qui existent.
 */
function isAvailableAndFreeFrom(
  gameMaster: GameMaster,
  timeSlotId: string,
  length: number,
  day: Day,
  schedule: Schedule,
): boolean {
  const timeSlotIds = day.consecutiveTimeSlotIdsFrom(timeSlotId, length);
  return (
    timeSlotIds !== null &&
    timeSlotIds.every(
      (slotId) =>
        gameMaster.isAvailableOnTimeSlot(slotId) &&
        !schedule.gameMasterRunsGameOnTimeSlot(gameMaster.id, slotId),
    )
  );
}

/** Pourquoi un scénario de `length` créneaux du MJ n'est ni en réserve ni programmé nulle part. */
function unschedulableRefusalOf(gameMaster: GameMaster, length: number, day: Day): Refusal {
  const nickname = gameMaster.nickname.text;
  if (!day.timeSlots.some((slot) => gameMaster.isAvailableOnTimeSlot(slot.id))) {
    return new Refusal('game-master-without-availability', { nickname });
  }
  const available = day.timeSlots.some((slot) =>
    day
      .consecutiveTimeSlotIdsFrom(slot.id, length)
      ?.every((slotId) => gameMaster.isAvailableOnTimeSlot(slotId)),
  );
  return available
    ? new Refusal('game-master-busy-everywhere', { nickname })
    : new Refusal('game-master-without-consecutive-availabilities', { nickname });
}
