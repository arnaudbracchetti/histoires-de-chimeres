import { request, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import { apiUrl, participantEndpoints, type AddedParticipantDto } from '@chimeres/contract';
import { expect } from '../../fixtures.js';

/** Attend la réponse d'un appel à l'API, et la refuse si elle échoue, avec son corps pour motif. */
export async function expectOk(response: Promise<APIResponse>): Promise<APIResponse> {
  const done = await response;
  expect(done.ok(), await done.text()).toBe(true);
  return done;
}

/** Prépare une donnée par l'API, avec le contexte de la page : le corps JSON de la réponse. */
export async function post<T>(page: Page, url: string, data: object): Promise<T> {
  return (await (await expectOk(page.request.post(url, { data }))).json()) as T;
}

/**
 * Un contexte d'API à lui seul (un téléphone et son cookie). Comme la config, il envoie `Origin`
 * pour passer le garde CSRF (ADR 0020).
 */
export function newApiContext(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
}

/**
 * Crée un MJ par l'assistant « Créer un pseudo », seule façon de créer un MJ, avec le contexte
 * donné (`page.request`, ou celui d'un projet sans page) : l'identifiant du MJ.
 */
export async function addGameMaster(api: APIRequestContext, nickname: string): Promise<string> {
  const response = await expectOk(
    api.post(apiUrl(participantEndpoints.add), { data: { nickname, roles: ['game-master'] } }),
  );
  return ((await response.json()) as AddedParticipantDto).gameMasterId!;
}
