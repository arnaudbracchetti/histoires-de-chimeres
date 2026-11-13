import type { LocalMomentDto } from '@chimeres/contract';
import type { LocalMoment } from '@chimeres/domain';

/** Un moment local de la convention, en `AAAA-MM-JJ` et `HH:MM`. */
export function toLocalMomentDto({ date, time }: LocalMoment): LocalMomentDto {
  return { date, time: time.toString() };
}
