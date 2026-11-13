import type { Page } from '@playwright/test';
import {
  apiUrl,
  availabilityEndpoints,
  gameMasterEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';
import { addGameMaster } from './api.js';

// Espace insécable (U+00A0) et espace fine insécable (U+202F) de docs/design/ton.md.
const NBSP = ' ';
const THIN = ' ';

/** Crée les MJ par l'API, et renvoie la liste relue. */
async function addThroughApi(page: Page, ...nicknames: string[]): Promise<GameMasterDto[]> {
  for (const nickname of nicknames) await addGameMaster(page.request, nickname);
  const response = await page.request.get(apiUrl(gameMasterEndpoints.list));
  expect(response.ok()).toBe(true);
  return (await response.json()) as GameMasterDto[];
}

function list(page: Page) {
  const table = page.getByRole('table', { name: 'MJ de la convention' });
  return {
    button: (name: string) => page.getByRole('button', { name, exact: true }),
    /** Les pseudos affichés. */
    nicknames: table.locator('tbody th a'),
    filter: page.getByRole('searchbox', { name: 'Filtrer les MJ' }),
  };
}

test('changer le pseudo dans l’en-tête de la fiche', async ({ page }) => {
  await addThroughApi(page, 'Élodie');
  await page.goto('/gestion/mj');
  await page.getByRole('link', { name: 'Élodie' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Élodie' })).toBeFocused();
  await expect(page.getByRole('navigation', { name: "Fil d'Ariane" })).toHaveText(/MJ.*Élodie/);
  await page.getByRole('button', { name: 'Modifier le pseudo' }).click();
  const field = page.getByRole('textbox', { name: 'Pseudo du MJ' });
  await expect(field).toBeFocused();
  await field.fill('Élodie la Rouge');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { level: 1, name: 'Élodie la Rouge' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier le pseudo' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Élodie la Rouge' })).toBeVisible();
});

test('supprimer un MJ sans scénario depuis « ⋯ », avec ses disponibilités (PR-12)', async ({
  page,
}) => {
  const [elodie] = await addThroughApi(page, 'Élodie', 'Kaïros');
  for (const data of [
    { start: '09:00', end: '11:30' },
    { start: '14:00', end: '16:30' },
  ]) {
    const response = await page.request.post(apiUrl(timeSlotEndpoints.add), { data });
    expect(response.ok()).toBe(true);
    for (const { id: timeSlotId } of ((await response.json()) as ConventionDto).timeSlots) {
      await page.request.put(
        apiUrl(availabilityEndpoints.declare, { gameMasterId: elodie!.id, timeSlotId }),
      );
    }
  }
  await page.goto(`/gestion/mj/${elodie!.id}`);

  await page.getByRole('button', { name: 'Autres actions sur le MJ' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer le MJ' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: `Supprimer le MJ «${NBSP}Élodie${NBSP}»${THIN}?`,
  });
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await expect(dialog).toContainText('Ses 2 disponibilités seront supprimées.');
  await dialog.getByRole('button', { name: 'Supprimer le MJ' }).click();

  await expect(page).toHaveURL(/\/gestion\/mj$/);
  await expect(list(page).nicknames).toHaveText(['Kaïros']);
});

test('un filtre sans résultat propose « Effacer le filtre »', async ({ page }) => {
  await addThroughApi(page, 'Élodie', 'Kaïros');
  await page.goto('/gestion/mj');
  const gameMasters = list(page);

  await gameMasters.filter.fill('kai');
  await expect(gameMasters.nicknames).toHaveText(['Kaïros']);
  await gameMasters.filter.fill('Zorglub');
  await expect(page.getByText('Aucun MJ ne correspond')).toBeVisible();
  await gameMasters.button('Effacer le filtre').click();

  await expect(gameMasters.nicknames).toHaveText(['Élodie', 'Kaïros']);
});

test('un lien profond ouvre la fiche du MJ', async ({ page }) => {
  const [kairos] = await addThroughApi(page, 'Kaïros');

  await page.goto(`/gestion/mj/${kairos!.id}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Kaïros' })).toBeVisible();
  await expect(page).toHaveTitle(/^Fiche du MJ/);
});
