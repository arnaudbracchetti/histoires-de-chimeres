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

// Espace insécable (U+00A0) et espace fine insécable (U+202F) de docs/design/ton.md.
const NBSP = ' ';
const THIN = ' ';

/** Crée les MJ par l'API, et renvoie la liste relue. */
async function addThroughApi(page: Page, ...nicknames: string[]): Promise<GameMasterDto[]> {
  let gameMasters: GameMasterDto[] = [];
  for (const nickname of nicknames) {
    const response = await page.request.post(apiUrl(gameMasterEndpoints.add), {
      data: { nickname },
    });
    expect(response.ok()).toBe(true);
    gameMasters = await response.json();
  }
  return gameMasters;
}

function list(page: Page) {
  const table = page.getByRole('table', { name: 'MJ de la convention' });
  const newRow = table.locator('tr.new');
  return {
    button: (name: string) => page.getByRole('button', { name, exact: true }),
    /** Les pseudos affichés, hors ligne en saisie. */
    nicknames: table.locator('tbody th a'),
    filter: page.getByRole('searchbox', { name: 'Filtrer les MJ' }),
    newRow,
    input: newRow.getByRole('textbox', { name: 'Pseudo du nouveau MJ' }),
  };
}

test('créer des MJ à la chaîne, et les voir dans l’ordre naturel', async ({ page }) => {
  await addThroughApi(page, 'Kaïros');
  await page.goto('/gestion/mj');
  const gameMasters = list(page);

  await gameMasters.button('Ajouter un MJ').click();
  for (const [saved, nickname] of ['Élodie', 'Brune', 'Zélie'].entries()) {
    await expect(gameMasters.input).toBeFocused();
    await gameMasters.input.fill(nickname);
    await page.keyboard.press('Enter');
    // La ligne suivante s'ouvre une fois la précédente enregistrée, vide.
    await expect(gameMasters.nicknames).toHaveCount(saved + 2);
    await expect(gameMasters.input).toHaveValue('');
  }
  await page.keyboard.press('Escape');

  await expect(gameMasters.newRow).toHaveCount(0);
  await expect(gameMasters.button('Ajouter un MJ')).toBeFocused();
  await expect(gameMasters.nicknames).toHaveText(['Brune', 'Élodie', 'Kaïros', 'Zélie']);
  await page.reload();
  await expect(gameMasters.nicknames).toHaveText(['Brune', 'Élodie', 'Kaïros', 'Zélie']);
});

test('« elodie » est refusé à côté d’« Élodie », « Jean Luc » accepté à côté de « Jean-Luc » (ID-7)', async ({
  page,
}) => {
  await addThroughApi(page, 'Élodie', 'Jean-Luc');
  await page.goto('/gestion/mj');
  const gameMasters = list(page);
  await gameMasters.button('Ajouter un MJ').click();

  await gameMasters.input.fill('elodie');
  await gameMasters.button('Ajouter').click();
  await expect(gameMasters.input).toBeFocused();
  await expect(gameMasters.input).toHaveAccessibleDescription(
    `Le MJ «${NBSP}Élodie${NBSP}» porte déjà ce pseudo${NBSP}: choisis-en un autre.`,
  );

  await gameMasters.input.fill('Jean Luc');
  await gameMasters.button('Ajouter').click();
  await expect(gameMasters.nicknames).toHaveText(['Élodie', 'Jean Luc', 'Jean-Luc']);
});

test('une erreur ne décale rien : la ligne et ses boutons restent en place', async ({ page }) => {
  await addThroughApi(page, 'Élodie', 'Kaïros');
  await page.goto('/gestion/mj');
  const gameMasters = list(page);
  await gameMasters.button('Ajouter un MJ').click();
  const cancel = await gameMasters.button('Annuler').boundingBox();
  const row = await gameMasters.newRow.boundingBox();
  const kairos = await gameMasters.nicknames.last().boundingBox();

  await gameMasters.input.fill('elodie');
  await page.keyboard.press('Enter');

  await expect(gameMasters.input).toHaveAccessibleDescription(/porte déjà ce pseudo/);
  expect(await gameMasters.button('Annuler').boundingBox()).toEqual(cancel);
  expect(await gameMasters.newRow.boundingBox()).toEqual(row);
  expect(await gameMasters.nicknames.last().boundingBox()).toEqual(kairos);
});

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

test('sans MJ, l’état vide invite à créer le premier', async ({ page }) => {
  await page.goto('/gestion/mj');
  const gameMasters = list(page);

  await gameMasters.button('Créer le premier MJ').click();
  await gameMasters.input.fill('Élodie');
  await page.keyboard.press('Enter');

  await expect(gameMasters.nicknames).toHaveText(['Élodie']);
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
