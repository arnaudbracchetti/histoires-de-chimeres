import type { ReserveScenario } from '@chimeres/application';
import type { ReserveScenarioDto } from '@chimeres/contract';
import { verdictOf } from '../../http/problem-catalogue.js';

/**
 * La réserve, pour le programme et pour le suivi : un scénario sans créneau possible porte le motif
 * et la phrase de son refus.
 */
export function toReserveDto(reserve: readonly ReserveScenario[]): ReserveScenarioDto[] {
  return reserve.map(({ unschedulable, ...scenario }) => ({
    ...scenario,
    unschedulable: unschedulable && verdictOf(unschedulable),
  }));
}
