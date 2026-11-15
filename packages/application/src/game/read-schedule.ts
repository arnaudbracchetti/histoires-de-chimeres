import type { GameDto, ScheduleScenarioDto, TimeSlotStateDto } from '@chimeres/contract';
import type { Convention, ReserveOfScenario, ScenarioCatalogue } from '@chimeres/domain';
import type { Clock } from '../clock.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';
import type { ScheduleReader } from './schedule-reader.js';

/** Un scénario de la réserve : sa présentation, et sa place que la convention calcule. */
export type ReserveScenario = ScheduleScenarioDto & Omit<ReserveOfScenario, 'scenarioId'>;

/**
 * Le programme, la réserve dans l'ordre naturel des titres, et l'état de chaque créneau dans
 * l'ordre de la journée.
 */
export type Schedule = {
  games: GameDto[];
  reserve: ReserveScenario[];
  timeSlots: { timeSlotId: string; state: TimeSlotStateDto }[];
};

/**
 * Le programme, avec la réserve (PR-6) et l'état de chaque créneau à cet instant, terminé compris,
 * que la convention calcule.
 */
export class ReadSchedule {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly reader: ScheduleReader,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<Schedule> {
    const [convention, catalogue, games] = await Promise.all([
      this.conventions.get(),
      this.scenarios.catalogue(),
      this.reader.games(),
    ]);
    const now = this.clock.now();
    return {
      games,
      reserve: await readReserve(convention, catalogue, this.reader),
      timeSlots: convention.timeSlots.map(({ id }) => ({
        timeSlotId: id,
        state: convention.computeTimeSlotStateAt(id, now),
      })),
    };
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
