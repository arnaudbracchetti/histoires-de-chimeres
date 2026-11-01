import type { SignUpTrackingDto, TimeSlotTrackingDto } from '@chimeres/contract';
import type { TimeSlotReserveEntry } from '@chimeres/domain';
import type { ConventionRepository } from '../convention/convention-repository.js';
import { readReserve, type ReserveScenario } from '../game/read-schedule.js';
import type { ScheduleReader } from '../game/schedule-reader.js';
import type { ScenarioRepository } from '../scenario/scenario-repository.js';

/** Le suivi d'un créneau, avec sa réserve, dont les motifs restent des refus du domaine. */
export type TrackedTimeSlot = Omit<TimeSlotTrackingDto, 'reserve'> & {
  reserve: TimeSlotReserveEntry[];
};

/** Le suivi des inscriptions, avec la réserve, comme dans le programme. */
export type SignUpTracking = Omit<SignUpTrackingDto, 'timeSlots' | 'reserve'> & {
  timeSlots: TrackedTimeSlot[];
  reserve: ReserveScenario[];
};

/**
 * Le suivi des inscriptions de chaque créneau, que la convention calcule avec le catalogue entier
 * (§4.4), les tables de la convention, les parties du programme avec leur suivi, et la réserve.
 */
export class ReadSignUpTracking {
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly scenarios: ScenarioRepository,
    private readonly reader: ScheduleReader,
  ) {}

  async execute(): Promise<SignUpTracking> {
    const [convention, catalogue, games] = await Promise.all([
      this.conventions.get(),
      this.scenarios.catalogue(),
      this.reader.games(),
    ]);
    const slots = new Map(convention.timeSlots.map((slot) => [slot.id, slot]));
    const nicknames = new Map(
      convention.participants.map((participant) => [participant.id, participant.nickname.text]),
    );
    const tracking = convention.computeSignUpTracking(catalogue);
    const reserve = await readReserve(convention, catalogue, this.reader);
    // L'ordre naturel des titres, que la réserve suit.
    const titleOrder = new Map(reserve.map(({ id }, index) => [id, index]));
    const gameTracking = new Map(
      tracking.flatMap((slot) => slot.games).map(({ gameId, ...figures }) => [gameId, figures]),
    );
    return {
      timeSlots: tracking.map(({ timeSlotId, state, demand, capacity, participants, ...slot }) => ({
        id: timeSlotId,
        rank: convention.getTimeSlotRank(timeSlotId),
        start: slots.get(timeSlotId)!.start.toString(),
        end: slots.get(timeSlotId)!.end.toString(),
        state,
        demand,
        capacity,
        participants: participants.map(({ participantId, gameIds, risk }) => ({
          id: participantId,
          nickname: nicknames.get(participantId)!,
          gameIds,
          risk,
        })),
        // Les programmables d'abord, puis les autres, chaque groupe dans l'ordre naturel des titres.
        reserve: slot.reserve.toSorted(
          (a, b) =>
            Number(a.refusal !== null) - Number(b.refusal !== null) ||
            titleOrder.get(a.scenarioId)! - titleOrder.get(b.scenarioId)!,
        ),
      })),
      tables: convention.tables.map((table) => ({ id: table.id, name: table.name.text })),
      // Une partie écrite entre les deux lectures attend la relecture suivante.
      games: games.flatMap((game) => {
        const figures = gameTracking.get(game.id);
        return figures ? [{ ...game, ...figures }] : [];
      }),
      reserve,
    };
  }
}
