import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ACCESS_LINK_PAGES, API_PREFIX, BACK_OFFICE_ROOT } from '@chimeres/contract';

/** Réglages communs à main.ts et aux tests qui démarrent l'application. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  // Caddy, sur le réseau Docker, écrit l'adresse du téléphone dans X-Forwarded-For : sans cela,
  // tous les téléphones auraient l'adresse de Caddy, et partageraient la limite d'essais du code
  // de présence.
  app.set('trust proxy', 'loopback, uniquelocal');
  // La page d'un lien d'accès porte son jeton dans l'URL : aucune requête partie d'elle ne la
  // donne en `Referer` (ADR 0018).
  app.use(
    `${BACK_OFFICE_ROOT}${ACCESS_LINK_PAGES}`,
    (_request: unknown, response: Response, next: () => void) => {
      response.setHeader('Referrer-Policy', 'no-referrer');
      next();
    },
  );
}
