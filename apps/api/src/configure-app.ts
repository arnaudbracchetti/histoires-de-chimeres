import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@chimeres/contract';

/** Réglages communs à main.ts et aux tests qui démarrent l'application. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  // Caddy, sur le réseau Docker, écrit l'adresse du téléphone dans X-Forwarded-For : sans cela,
  // tous les téléphones auraient l'adresse de Caddy, et partageraient la limite d'essais du code
  // de présence.
  app.set('trust proxy', 'loopback, uniquelocal');
}
