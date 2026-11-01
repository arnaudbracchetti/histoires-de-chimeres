import type { GameDto, ScheduleScenarioDto } from '@chimeres/contract';
import type { Convention, ReserveOfScenario, ScenarioCatalogue } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';
import type { ScheduleReader } from './schedule-reader.js';

/** Un scénario de la réserve : sa présentation, et sa place que la convention calcule. */
export type ReserveScenario = ScheduleScenarioDto & Omit<ReserveOfScenario, 'scenarioId'>;

/** Le programme, et la réserve dans l'ordre naturel des titres. */
export type Schedule = { games: GameDto[]; reserve: ReserveScenario[] };

/** Le programme, avec la réserve que la convention calcule (PR-6). */
export class ReadSchedule {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly reader: ScheduleReader,
  ) {}

  async execute(): Promise<Schedule> {
    const [convention, catalogue, games] = await Promise.all([
      this.conventions.get(),
      this.scenarios.catalogue(),
      this.reader.games(),
    ]);
    return { games, reserve: await readReserve(convention, catalogue, this.reader) };
  }
}

/**
 * La réserve, que la convention calcule (PR-6), avec la présentation de chaque scénario, dans
 * l'ordre naturel des titres.
 */
export async function readReserve(
  convention: Convention,
  catalogue: ScenarioCatalogue,
  reader: ScheduleReader,
): Promise<ReserveScenario[]> {
  const places = new Map(
    convention.computeReserve(catalogue).map(({ scenarioId, ...place }) => [scenarioId, place]),
  );
  const scenarios = await reader.scenarios([...places.keys()]);
  return scenarios.map((scenario) => ({ ...scenario, ...places.get(scenario.id)! }));
}
