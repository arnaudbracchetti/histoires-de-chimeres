import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CrossSiteRequestError } from './cross-site-request.error.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Garde global contre le CSRF (ADR 0019) : une écriture n'est acceptée que si le navigateur la
 * dit `same-origin` par `Sec-Fetch-Site`. Sans cet en-tête (navigateur ancien, client hors
 * navigateur), son `Origin` doit être le domaine public (`PUBLIC_URL`). Pas de jeton XSRF.
 */
@Injectable()
export class CrossSiteWriteGuard implements CanActivate {
  private readonly publicOrigin = publicOriginFromEnvironment();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!WRITE_METHODS.has(request.method)) return true;
    if (this.isFromOwnSite(request)) return true;
    throw new CrossSiteRequestError();
  }

  private isFromOwnSite(request: Request): boolean {
    const site = request.get('Sec-Fetch-Site');
    if (site !== undefined) return site === 'same-origin';
    const origin = request.get('Origin');
    return origin !== undefined && this.publicOrigin !== null && origin === this.publicOrigin;
  }
}

/** L'origine de `PUBLIC_URL` (`https://chimeres.example.org`), ou `null` si elle manque. */
function publicOriginFromEnvironment(): string | null {
  const publicUrl = process.env['PUBLIC_URL'];
  if (!publicUrl) return null;
  return new URL(publicUrl).origin;
}
