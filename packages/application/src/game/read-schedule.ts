import type { ScheduleDto } from '@chimeres/contract';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';
import type { ScheduleReader } from './schedule-reader.js';

/** Le programme, avec la réserve de chaque créneau, que la convention calcule (PR-6). */
export class ReadSchedule {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly reader: ScheduleReader,
  ) {}

  async execute(): Promise<ScheduleDto> {
    const [convention, catalogue, games] = await Promise.all([
      this.conventions.get(),
      this.scenarios.catalogue(),
      this.reader.games(),
    ]);
    const reserve = convention.reserve(catalogue);
    const scenarios = await this.reader.scenarios([
      ...new Set(reserve.flatMap(({ scenarioIds }) => scenarioIds)),
    ]);
    return { games, reserve, scenarios };
  }
}
