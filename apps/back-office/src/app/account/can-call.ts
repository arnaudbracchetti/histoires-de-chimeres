import {
  isAccessAllowed,
  type ConnectedAccountDto,
  type Endpoint,
  type ParamsArgs,
} from '@chimeres/contract';

/**
 * Le compte connecté peut-il appeler cet endpoint ? La règle de l'API (`isAccessAllowed()`), lue
 * sur le niveau d'accès du descripteur (ADR 0017), pour masquer un geste interdit.
 */
export function canCall<E extends Endpoint<unknown, unknown, unknown, unknown>>(
  account: ConnectedAccountDto | undefined,
  endpoint: E,
  ...[params]: ParamsArgs<E>
): boolean {
  const gameMasterId = (params as { gameMasterId?: string } | undefined)?.gameMasterId;
  return isAccessAllowed(endpoint.access, account ?? null, gameMasterId);
}
