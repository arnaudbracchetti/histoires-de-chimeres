import type { SignUpTrackingDto } from '@chimeres/contract';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Le suivi des inscriptions de chaque créneau, que la convention calcule avec le catalogue entier
 * (§4.4), et les tables de la convention.
 */
export class ReadSignUpTracking {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
  ) {}

  async execute(): Promise<SignUpTrackingDto> {
    const [convention, catalogue] = await Promise.all([
      this.conventions.get(),
      this.scenarios.catalogue(),
    ]);
    const slots = new Map(convention.timeSlots.map((slot) => [slot.id, slot]));
    return {
      timeSlots: convention
        .computeSignUpTracking(catalogue)
        .map(({ timeSlotId, state, demand, capacity }) => ({
          id: timeSlotId,
          rank: convention.getTimeSlotRank(timeSlotId),
          start: slots.get(timeSlotId)!.start.toString(),
          end: slots.get(timeSlotId)!.end.toString(),
          state,
          demand,
          capacity,
        })),
      tables: convention.tables.map((table) => ({ id: table.id, name: table.name.text })),
    };
  }
}
