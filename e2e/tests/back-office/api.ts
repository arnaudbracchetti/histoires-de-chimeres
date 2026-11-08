import type { APIResponse, Page } from '@playwright/test';
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
