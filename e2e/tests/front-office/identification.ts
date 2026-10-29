import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  apiUrl,
  conventionEndpoints,
  PRESENCE_CODE_PARAM,
  type ConventionDto,
} from '@chimeres/contract';

/** Le code de présence, lu dans le DTO de la convention. */
export async function presenceCodeOf(request: APIRequestContext): Promise<string> {
  const response = await request.get(apiUrl(conventionEndpoints.read));
  expect(response.ok()).toBe(true);
  return ((await response.json()) as ConventionDto).presenceCode;
}

/**
 * Un pseudo propre au test : la base du projet `mobile` n'est pas remise à zéro entre deux tests,
 * et les pseudos sont uniques dans la convention.
 */
export function aNickname(name: string): string {
  return `${name} ${Math.random().toString(36).slice(2, 8)}`;
}

/** Ouvre le front office par l'adresse du QR code, puis tape le pseudo. */
export async function identify(page: Page, nickname: string): Promise<void> {
  await page.goto(`/?${PRESENCE_CODE_PARAM}=${await presenceCodeOf(page.request)}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
  await page.getByLabel('Pseudo', { exact: true }).fill(nickname);
  await page.getByRole('button', { name: 'Continuer' }).click();
}

/** Le bouton du pseudo, en haut de la coquille. */
export const nicknameButton = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: /./ });
