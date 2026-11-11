import type { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import type { App } from 'supertest/types.js';

/** Ce qu'envoie un navigateur pour une requête du site lui-même : passe le garde CSRF (ADR 0019). */
const SAME_ORIGIN = { 'Sec-Fetch-Site': 'same-origin' };

/**
 * Les requêtes des tests vers l'application, comme `supertest`, mais chaque écriture se dit
 * `same-origin` (ADR 0020). Avec `cookie` (celui d'une session, par `insertAccountSession`), chaque
 * requête l'envoie ; un `.set('Cookie', …)` du test le remplace.
 */
export function request(app: INestApplication<App>, cookie?: string) {
  const server = supertest(app.getHttpServer());
  const sendSessionCookie = (test: supertest.Test) => (cookie ? test.set('Cookie', cookie) : test);
  return {
    get: (url: string) => sendSessionCookie(server.get(url)),
    post: (url: string) => sendSessionCookie(server.post(url).set(SAME_ORIGIN)),
    put: (url: string) => sendSessionCookie(server.put(url).set(SAME_ORIGIN)),
    patch: (url: string) => sendSessionCookie(server.patch(url).set(SAME_ORIGIN)),
    delete: (url: string) => sendSessionCookie(server.delete(url).set(SAME_ORIGIN)),
  };
}

export type { Response, Test } from 'supertest';
