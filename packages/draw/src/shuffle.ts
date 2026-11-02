import type { RandomSource } from '@chimeres/domain';

/** Une copie mélangée de `list` (Fisher-Yates) : chaque ordre a la même probabilité. */
export function shuffle<T>(list: readonly T[], random: RandomSource): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
