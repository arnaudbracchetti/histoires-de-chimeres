import type { DurationDto } from '@chimeres/contract';
import { countOf } from '@chimeres/design';

/** « 1 créneau », « 2 créneaux » : la durée d'un scénario. */
export function formatScenarioDuration(duration: DurationDto): string {
  return countOf(duration, 'créneau', 'créneaux');
}
