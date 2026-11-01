import type { SignUpTrackingDto } from '@chimeres/contract';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { ScheduleReader } from '../game/schedule-reader.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/**
 * Le suivi des inscriptions de chaque créneau, que la convention calcule avec le catalogue entier
 * (§4.4), les tables de la convention, et les parties du programme avec leur suivi.
 */
export class ReadSignUpTracking {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly reader: ScheduleReader,
  ) {}

  async execute(): Promise<SignUpTrackingDto> {
    const [convention, catalogue, games] = await Promise.all([
      this.conventions.get(),
      this.scenarios.catalogue(),
      this.reader.games(),
    ]);
    const slots = new Map(convention.timeSlots.map((slot) => [slot.id, slot]));
    const tracking = convention.computeSignUpTracking(catalogue);
    const gameTracking = new Map(
      tracking.flatMap((slot) => slot.games).map(({ gameId, ...figures }) => [gameId, figures]),
    );
    return {
      timeSlots: tracking.map(({ timeSlotId, state, demand, capacity }) => ({
        id: timeSlotId,
        rank: convention.getTimeSlotRank(timeSlotId),
        start: slots.get(timeSlotId)!.start.toString(),
        end: slots.get(timeSlotId)!.end.toString(),
        state,
        demand,
        capacity,
      })),
      tables: convention.tables.map((table) => ({ id: table.id, name: table.name.text })),
      // Une partie écrite entre les deux lectures attend la relecture suivante.
      games: games.flatMap((game) => {
        const figures = gameTracking.get(game.id);
        return figures ? [{ ...game, ...figures }] : [];
      }),
    };
  }
}
