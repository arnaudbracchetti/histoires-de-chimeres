import {
  Inject,
  Injectable,
  RequestMethod,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { NotLoggedInError, type AccountReader, type AccountSessions } from '@chimeres/application';
import { isAccessAllowed, type EndpointAccess } from '@chimeres/contract';
import { AccessDeniedError } from './access-denied.error.js';
import { ACCOUNT_READER } from './account-reader.token.js';
import { ACCOUNT_SESSIONS } from './account-sessions.token.js';
import { contractEndpoints } from './contract-endpoints.js';
import { readAccountSessionId } from './http/account-session-cookie.js';

/** Le compte de la session, posé sur la requête par le garde d'accès (ADR 0017). */
export type RequestAccount = {
  accountId: string;
  organizer: boolean;
  gameMasterId: string | null;
};

const routeKey = (method: string, path: string) => `${method} ${path}`;

/** Le niveau d'accès de chaque route, lu sur tous les descripteurs de `contract`. */
const accessByRoute = new Map<string, EndpointAccess>(
  contractEndpoints.map(([, { method, path, access }]) => [routeKey(method, path), access]),
);

/**
 * Garde global d'accès (ADR 0017) : lit le niveau du descripteur de la route, par son chemin et sa
 * méthode. Une route sans descripteur est réservée aux Organisateurs. Hors `public` et `linkedPhone`,
 * retrouve la session par son cookie, puis son compte, à chaque requête et sans cache : un rôle
 * retiré vaut dès la requête suivante. 401 sans session, 403 sans le droit, selon
 * `isAccessAllowed()` de `contract`, que les fronts lisent aussi.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ACCOUNT_SESSIONS) private readonly sessions: AccountSessions,
    @Inject(ACCOUNT_READER) private readonly reader: AccountReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.readEndpointAccess(context);
    // `linkedPhone` : la commande vérifie le téléphone relié (ADR 0009), jamais la session (ID-3).
    if (access === 'public' || access === 'linkedPhone') return true;
    const request = context.switchToHttp().getRequest<Request>();
    const account = await this.readAccount(request);
    (request as Request & { account?: RequestAccount }).account = account;
    const { gameMasterId } = request.params as { gameMasterId?: string };
    if (isAccessAllowed(access, account, gameMasterId)) return true;
    throw new AccessDeniedError();
  }

  private readEndpointAccess(context: ExecutionContext): EndpointAccess {
    const handler = context.getHandler();
    const path = this.reflector.get<string | undefined>(PATH_METADATA, handler);
    const method = this.reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
    if (path === undefined || method === undefined) return 'organizer';
    return accessByRoute.get(routeKey(RequestMethod[method], path)) ?? 'organizer';
  }

  private async readAccount(request: Request): Promise<RequestAccount> {
    const sessionId = readAccountSessionId(request);
    const accountId = sessionId && (await this.sessions.findAccountIdAndExtend(sessionId));
    const account = accountId ? await this.reader.read(accountId) : null;
    if (!accountId || !account) throw new NotLoggedInError();
    return { accountId, organizer: account.organizer, gameMasterId: account.gameMasterId };
  }
}
