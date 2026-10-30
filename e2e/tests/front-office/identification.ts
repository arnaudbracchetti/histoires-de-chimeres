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

/**
 * Un téléphone qui n'a pas encore répondu à la demande des notifications, et qui la refuse quand
 * on la lui fait. Chromium sans écran n'ouvre pas cette demande : la page la joue.
 */
async function phoneNotYetAsked(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let permission: NotificationPermission = 'default';
    Object.defineProperty(Notification, 'permission', { get: () => permission });
    Notification.requestPermission = async () => (permission = 'denied');
  });
}

/**
 * Ouvre le front office par l'adresse du QR code, puis tape le pseudo. Le téléphone n'a pas encore
 * répondu à la demande des notifications.
 */
export async function enterNickname(page: Page, nickname: string): Promise<void> {
  await phoneNotYetAsked(page);
  await page.goto(`/?${PRESENCE_CODE_PARAM}=${await presenceCodeOf(page.request)}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
  await page.getByLabel('Pseudo', { exact: true }).fill(nickname);
  await page.getByRole('button', { name: 'Continuer' }).click();
}

/** Remet les notifications à plus tard, sans les activer : la coquille s'ouvre (§4.2). */
export async function skipNotifications(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Active les notifications');
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await page
    .getByRole('alertdialog', { name: /^Continuer sans notifications/ })
    .getByRole('button', { name: 'Continuer sans' })
    .click();
}

/** S'identifie par un pseudo nouveau, puis remet les notifications à plus tard. */
export async function identify(page: Page, nickname: string): Promise<void> {
  await enterNickname(page, nickname);
  await skipNotifications(page);
}

/** Le bouton du pseudo, en haut de la coquille. */
export const nicknameButton = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: /./ });
