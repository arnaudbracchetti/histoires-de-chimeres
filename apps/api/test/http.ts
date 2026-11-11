import type { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import type { App } from 'supertest/types.js';

/** Ce qu'envoie un navigateur pour une requête du site lui-même : passe le garde CSRF (ADR 0019). */
const SAME_ORIGIN = { 'Sec-Fetch-Site': 'same-origin' };

/**
 * Les requêtes des tests vers l'application, comme `supertest`, mais chaque écriture se dit
 * `same-origin` (ADR 0020).
 */
export function request(app: INestApplication<App>) {
  const server = supertest(app.getHttpServer());
  return {
    get: (url: string) => server.get(url),
    post: (url: string) => server.post(url).set(SAME_ORIGIN),
    put: (url: string) => server.put(url).set(SAME_ORIGIN),
    patch: (url: string) => server.patch(url).set(SAME_ORIGIN),
    delete: (url: string) => server.delete(url).set(SAME_ORIGIN),
  };
}

export type { Response, Test } from 'supertest';
