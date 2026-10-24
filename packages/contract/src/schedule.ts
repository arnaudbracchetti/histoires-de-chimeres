import { endpoint } from './endpoint.js';
import type { RefusalCode } from './problem.js';
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
  /** Ses places : celles de son scénario, sauf si l'Organisateur en a fixé d'autres (PR-4). */
  seats: SeatsDto;
  scenario: ScheduleScenarioDto;
};

/** Un refus du domaine, avec son motif court et sa phrase. */
export type VerdictRefusalDto = { code: RefusalCode; title: string; detail: string };

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

export type ScheduleGameBody = { scenarioId: string; timeSlotId: string; tableId: string };

export type GameParams = { gameId: string };

/** La nouvelle place d'une partie : pour une partie double, son premier créneau. */
export type MoveGameBody = { timeSlotId: string; tableId: string };

/**
 * `placements` et `movePlacements` rendent la grille dans l'ordre des créneaux, puis des tables.
 * Programmer, déplacer et déprogrammer renvoient le programme relu.
 */
export const scheduleEndpoints = {
  read: endpoint<ScheduleDto>('GET', 'schedule'),
  placements: endpoint<PlacementDto[], ScenarioParams>('GET', 'scenarios/:scenarioId/placements'),
  schedule: endpoint<ScheduleDto, never, ScheduleGameBody>('POST', 'games'),
  movePlacements: endpoint<PlacementDto[], GameParams>('GET', 'games/:gameId/placements'),
  move: endpoint<ScheduleDto, GameParams, MoveGameBody>('PUT', 'games/:gameId/placement'),
  unschedule: endpoint<ScheduleDto, GameParams>('DELETE', 'games/:gameId'),
};
