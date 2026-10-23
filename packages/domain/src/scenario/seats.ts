import { Refusal } from '../refusal.js';

/** Places : le nombre de joueurs qu'une partie accueille, MJ non compris. 1 ≤ min ≤ max, sans plafond. */
export class Seats {
  private constructor(
    readonly min: number,
    readonly max: number,
  ) {}

  /** Des nombres entiers : l'API refuse tout autre nombre avant le domaine. */
  static of(min: number, max: number): Seats {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new RangeError(`Places non entières : ${min} à ${max}.`);
    }
    if (min < 1) throw new Refusal('seats-min-below-one', {});
    if (max < min) throw new Refusal('seats-out-of-order', {});
    return new Seats(min, max);
  }
}
