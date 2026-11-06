import type { ScheduleScenarioDto } from '@chimeres/contract';
import type { CellPlacement } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';
import type { ScheduleReader } from './schedule-reader.js';

/** Le verdict d'une case pour un scénario, avec sa présentation. */
export type ScenarioCellPlacement = Omit<CellPlacement, 'scenarioId'> & {
  scenario: ScheduleScenarioDto;
};

/**
 * Les verdicts d'une case (un créneau, une table), que la convention calcule avec le catalogue
 * entier et la règle de l'écriture (PR-5), pour « Programmer ici… » sur une table libre.
 */
export class ReadCellPlacements {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly reader: ScheduleReader,
  ) {}

  /**
   * Les scénarios programmables d'abord, puis les autres, chaque groupe dans l'ordre naturel des
   * titres. Un créneau ou une table inconnus sont un refus du domaine.
   */
  async execute(timeSlotId: string, tableId: string): Promise<ScenarioCellPlacement[]> {
    const [convention, catalogue] = await Promise.all([
      this.conventions.get(),
      this.scenarios.catalogue(),
    ]);
    const verdicts = new Map(
      convention
        .computeCellPlacementVerdicts(catalogue, timeSlotId, tableId)
        .map(({ scenarioId, ...verdict }) => [scenarioId, verdict]),
    );
    const scenarios = await this.reader.scenarios([...verdicts.keys()]);
    return scenarios
      .flatMap((scenario) => {
        const verdict = verdicts.get(scenario.id);
        return verdict ? [{ scenario, ...verdict }] : [];
      })
      .toSorted((a, b) => Number(a.refusal !== null) - Number(b.refusal !== null));
  }
}
