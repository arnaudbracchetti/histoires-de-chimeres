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

/** La réserve d'un créneau (PR-6). */
export type ReserveDto = { timeSlotId: string; scenarioIds: string[] };

/** Le programme, et la réserve de chaque créneau. */
export type ScheduleDto = {
  games: GameDto[];
  /** Dans l'ordre de la journée. */
  reserve: ReserveDto[];
  /** Les scénarios de la réserve, dans l'ordre naturel de leur titre. */
  scenarios: ScheduleScenarioDto[];
};

/**
 * Le verdict d'une case créneau × table pour un scénario : `refusal` est `null` si on peut l'y
 * programmer, sinon le refus que l'écriture lèverait, avec son motif court et sa phrase.
 */
export type PlacementDto = {
  timeSlotId: string;
  tableId: string;
  refusal: { code: RefusalCode; title: string; detail: string } | null;
};

export type ScheduleGameBody = { scenarioId: string; timeSlotId: string; tableId: string };

/**
 * `placements` rend la grille dans l'ordre des créneaux, puis des tables. Programmer renvoie le
 * programme relu.
 */
export const scheduleEndpoints = {
  read: endpoint<ScheduleDto>('GET', 'schedule'),
  placements: endpoint<PlacementDto[], ScenarioParams>('GET', 'scenarios/:scenarioId/placements'),
  schedule: endpoint<ScheduleDto, never, ScheduleGameBody>('POST', 'games'),
};
