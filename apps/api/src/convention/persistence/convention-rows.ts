import type { Convention } from '@chimeres/domain';

/** Les lignes des enfants de la convention, table par table, chacune sous sa clé. */
export type ConventionRows = ReturnType<typeof rowsOf>;

export function rowsOf(convention: Convention) {
  return {
    timeSlots: keyed(
      convention.timeSlots.map((slot) => ({
        id: slot.id,
        startMinute: slot.start.minutes,
        endMinute: slot.end.minutes,
      })),
      ({ id }) => id,
    ),
    tables: keyed(
      convention.tables.map((table) => ({ id: table.id, name: table.name.text })),
      ({ id }) => id,
    ),
    gameMasters: keyed(
      convention.gameMasters.map((gameMaster) => ({
        id: gameMaster.id,
        participantId: gameMaster.participant.id,
      })),
      ({ id }) => id,
    ),
    availabilities: keyed(
      convention.gameMasters.flatMap((gameMaster) =>
        [...gameMaster.availabilities].map((timeSlotId) => ({
          gameMasterId: gameMaster.id,
          timeSlotId,
        })),
      ),
      ({ gameMasterId, timeSlotId }) => `${gameMasterId}:${timeSlotId}`,
    ),
    /** MJ compris : le pseudo d'un MJ est celui de son participant (ADR 0012). */
    participants: keyed(
      convention.participants.map((participant) => ({
        id: participant.id,
        nickname: participant.nickname.text,
      })),
      ({ id }) => id,
    ),
    signUps: keyed(
      convention.signUps.map(({ participantId, gameId }) => ({ participantId, gameId })),
      ({ participantId, gameId }) => `${participantId}:${gameId}`,
    ),
    /** Une partie avec ses créneaux : ils changent ensemble, quand elle se déplace. */
    games: keyed(
      convention.games.map((game) => ({
        id: game.id,
        scenarioId: game.scenarioId,
        timeSlots: game.timeSlotIds.map((timeSlotId) => ({
          gameId: game.id,
          timeSlotId,
          tableId: game.tableId,
          gameMasterId: game.gameMasterId,
        })),
      })),
      ({ id }) => id,
    ),
  };
}

function keyed<Row>(rows: Row[], keyOf: (row: Row) => string): Map<string, Row> {
  return new Map(rows.map((row) => [keyOf(row), row]));
}

/** Ce qui sépare deux états d'une table : les lignes parties, arrivées, ou au contenu changé. */
export function changes<Row>(
  before: Map<string, Row>,
  after: Map<string, Row>,
): { removed: Row[]; added: Row[]; changed: Row[] } {
  return {
    removed: [...before].filter(([key]) => !after.has(key)).map(([, row]) => row),
    added: [...after].filter(([key]) => !before.has(key)).map(([, row]) => row),
    changed: [...after]
      .filter(([key, row]) => before.has(key) && !sameContent(before.get(key)!, row))
      .map(([, row]) => row),
  };
}

/** Les lignes sont construites par `rowsOf`, donc leurs champs viennent toujours dans le même ordre. */
function sameContent<Row>(a: Row, b: Row): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
