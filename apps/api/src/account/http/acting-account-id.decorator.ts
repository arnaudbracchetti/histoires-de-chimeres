import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestAccount } from '../access.guard.js';

/**
 * L'identifiant du compte qui fait le geste, posé sur la requête par le garde d'accès (ADR 0017).
 * Seulement sur une route qui demande une session : hors `public` et `linkedPhone`.
 */
export const ActingAccountId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request & { account?: RequestAccount }>();
  return request.account!.accountId;
});
