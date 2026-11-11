import * as contract from '@chimeres/contract';
import type { Endpoint } from '@chimeres/contract';

export type AnyEndpoint = Endpoint<unknown, unknown, unknown, unknown>;

const isEndpoint = (value: unknown): value is AnyEndpoint => {
  const candidate = value as Partial<AnyEndpoint> | null;
  return typeof candidate?.path === 'string' && typeof candidate.access === 'string';
};

/**
 * Tous les descripteurs de `contract`, nommés `groupe.clé` (`scenarioEndpoints.read`), trouvés parmi
 * ses exports : un nouvel endpoint y entre sans rien déclarer ailleurs (ADR 0017).
 */
export const contractEndpoints: [string, AnyEndpoint][] = Object.entries(
  contract as Record<string, unknown>,
).flatMap(([group, value]) =>
  typeof value === 'object' && value !== null
    ? Object.entries(value)
        .filter((entry): entry is [string, AnyEndpoint] => isEndpoint(entry[1]))
        .map(([key, descriptor]): [string, AnyEndpoint] => [`${group}.${key}`, descriptor])
    : [],
);
