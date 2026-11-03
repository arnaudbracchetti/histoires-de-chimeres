import { randomInt } from 'node:crypto';
import type { RandomSource } from '@chimeres/domain';

/** 2^48 - 1 : la plus grande borne que `randomInt` accepte. Le quotient reste sous 1. */
const RANGE = 2 ** 48 - 1;

/** La source de hasard du tirage en production, tirée de `node:crypto`. */
export const cryptoRandom: RandomSource = () => randomInt(RANGE) / RANGE;
