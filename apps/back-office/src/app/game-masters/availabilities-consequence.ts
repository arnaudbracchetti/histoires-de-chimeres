import { countOf } from '../typography/french';

/**
 * Ce qui part avec un créneau ou un MJ supprimé (docs/design/patterns.md, Actions destructrices) :
 * « Ses 4 disponibilités seront supprimées. », ou rien sans disponibilité.
 */
export function availabilitiesConsequence(count: number): string | undefined {
  if (count === 0) return undefined;
  return count === 1
    ? 'Sa disponibilité sera supprimée.'
    : `Ses ${countOf(count, 'disponibilité', 'disponibilités')} seront supprimées.`;
}
