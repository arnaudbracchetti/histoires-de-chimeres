import { endpoint } from './endpoint.js';
import type { VerdictRefusalDto } from './problem.js';
import type {
  ScenarioGameMasterDto,
  ScenarioParams,
  ScenarioSummaryDto,
  SeatsDto,
} from './scenario.js';

/** Un scénario, tel que le Calendrier le montre : sur une carte de partie ou dans la réserve. */
export type ScheduleScenarioDto = ScenarioSummaryDto & { gameMaster: ScenarioGameMasterDto };

/** Une partie programmée. */
export type GameDto = {
  id: string;
  tableId: string;
  /** Ses créneaux, dans l'ordre de la journée. */
  timeSlotIds: string[];
  /** Ses places : celles de son scénario (PR-4). */
  seats: SeatsDto;
  scenario: ScheduleScenarioDto;
};

/**
 * Un scénario dans la réserve (PR-6). Sur chaque créneau, dans l'ordre de la journée : s'il y est en
 * réserve (sur ce créneau et le suivant pour un scénario double), et s'il y est programmé ; les deux
 * s'excluent. `unschedulable` : pourquoi il n'est ni en réserve ni programmé nulle part, ou `null`.
 */
export type ReserveScenarioDto = ScheduleScenarioDto & {
  timeSlots: { timeSlotId: string; inReserve: boolean; scheduled: boolean }[];
  unschedulable: VerdictRefusalDto | null;
};

/** Le programme, et la réserve. */
export type ScheduleDto = {
  games: GameDto[];
  /** Tous les scénarios, dans l'ordre naturel de leur titre. */
  reserve: ReserveScenarioDto[];
};

/**
 * Le verdict d'une case créneau × table pour un scénario : `refusal` est `null` si on peut l'y
 * programmer, sinon le refus que l'écriture lèverait, avec son motif court et sa phrase.
 */
export type PlacementDto = {
  timeSlotId: string;
  tableId: string;
  refusal: VerdictRefusalDto | null;
};

/**
 * Le verdict d'une case créneau × table pour un scénario sans partie qui commence sur ce créneau :
 * `refusal` est `null` si on peut l'y programmer, sinon le refus que l'écriture lèverait.
 */
export type CellPlacementDto = {
  scenario: ScheduleScenarioDto;
  refusal: VerdictRefusalDto | null;
};

/**
 * Les inscriptions qu'un geste retirerait à une partie (IN-6) : ses inscriptions actives
 * (`signUpCount`, IN-4), et combien de ses inscrits n'ont pas d'autre inscription active sur son
 * premier créneau (`withoutOtherSignUpCount`).
 */
export type RemovedSignUpsDto = {
  gameId: string;
  signUpCount: number;
  withoutOtherSignUpCount: number;
};

/**
 * Le verdict d'une case pour déplacer une partie. `swapWith` : sur la première case d'une autre
 * partie, l'id de celle-ci, avec laquelle l'échanger ; `null` pour un simple déplacement.
 * `removedSignUps` : sur une case permise, une entrée par partie qui perdrait ses inscriptions, dans
 * l'ordre du programme ; vide pour un changement de table, un échange sur le même créneau, une
 * partie sans inscrit ou une case refusée.
 */
export type MovePlacementDto = PlacementDto & {
  swapWith: string | null;
  removedSignUps: RemovedSignUpsDto[];
};

/** Le verdict de la déprogrammation d'une partie : vide si elle n'a aucun inscrit actif. */
export type UnscheduleVerdictDto = { removedSignUps: RemovedSignUpsDto[] };

export type ScheduleGameBody = { scenarioId: string; timeSlotId: string; tableId: string };

export type GameParams = { gameId: string };

/** Une case du programme. */
export type CellParams = { timeSlotId: string; tableId: string };

/** La nouvelle place d'une partie : pour une partie double, son premier créneau. */
export type MoveGameBody = { timeSlotId: string; tableId: string };

/** L'autre partie de l'échange, qui prend la place de celle du chemin. */
export type SwapGamesBody = { otherGameId: string };

/**
 * `placements` et `movePlacements` rendent la grille dans l'ordre des créneaux, puis des tables.
 * `cellPlacements` rend les verdicts d'une case : les scénarios programmables d'abord, puis les
 * autres, chaque groupe dans l'ordre naturel des titres.
 * `unscheduleVerdict` donne, avant de déprogrammer, les inscriptions que le geste retirerait.
 * Programmer, déplacer, échanger et déprogrammer renvoient le programme relu.
 */
export const scheduleEndpoints = {
  read: endpoint<ScheduleDto>('GET', 'schedule'),
  placements: endpoint<PlacementDto[], ScenarioParams>('GET', 'scenarios/:scenarioId/placements'),
  cellPlacements: endpoint<CellPlacementDto[], CellParams>(
    'GET',
    'time-slots/:timeSlotId/tables/:tableId/placements',
  ),
  schedule: endpoint<ScheduleDto, never, ScheduleGameBody>('POST', 'games'),
  movePlacements: endpoint<MovePlacementDto[], GameParams>('GET', 'games/:gameId/placements'),
  move: endpoint<ScheduleDto, GameParams, MoveGameBody>('PUT', 'games/:gameId/placement'),
  swap: endpoint<ScheduleDto, GameParams, SwapGamesBody>('POST', 'games/:gameId/swap'),
  unscheduleVerdict: endpoint<UnscheduleVerdictDto, GameParams>(
    'GET',
    'games/:gameId/unschedule-verdict',
  ),
  unschedule: endpoint<ScheduleDto, GameParams>('DELETE', 'games/:gameId'),
};
