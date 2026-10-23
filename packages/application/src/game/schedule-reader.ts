import type { GameDto, ScheduleScenarioDto } from '@chimeres/contract';

/** Port de lecture du programme, implémenté par l'infrastructure. */
export interface ScheduleReader {
  /** Les parties, dans l'ordre de leur programmation. */
  games(): Promise<GameDto[]>;
  /** Les scénarios demandés, dans l'ordre naturel de leur titre. */
  scenarios(scenarioIds: readonly string[]): Promise<ScheduleScenarioDto[]>;
}
