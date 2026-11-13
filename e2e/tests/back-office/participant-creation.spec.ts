import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures.js';
import { addGameMaster } from './api.js';

/** L'assistant « Créer un pseudo », ouvert en dialogue. */
function wizard(page: Page) {
  const dialog = page.getByRole('dialog');
  return {
    dialog,
    nickname: dialog.getByRole('textbox', { name: 'Pseudo' }),
    role: (name: 'MJ' | 'Organisateur') =>
      dialog.getByRole('checkbox', { name: new RegExp(`^${name}`) }),
    button: (name: string) => dialog.getByRole('button', { name, exact: true }),
  };
}

test('« Ajouter un MJ » crée un MJ par l’assistant, jusqu’à son lien d’accès (ID-16)', async ({
  page,
}) => {
  await page.goto('/gestion/mj');
  await page.getByRole('button', { name: 'Créer le premier MJ' }).click();
  const creation = wizard(page);

  await expect(creation.nickname).toBeFocused();
  await creation.nickname.fill('Élodie');
  await creation.button('Suivant').click();
  await expect(creation.role('MJ')).toBeChecked();
  await expect(creation.role('Organisateur')).not.toBeChecked();
  await creation.button('Créer le pseudo et son compte').click();

  await expect(
    creation.dialog.getByRole('heading', { name: /^Lien d'accès de «\s*Élodie\s*»$/ }),
  ).toBeVisible();
  await expect(creation.dialog.getByRole('textbox', { name: "Lien d'accès" })).toHaveValue(
    /^http:\/\/localhost:8081\/gestion\/.+/,
  );
  await expect(creation.dialog.getByRole('img', { name: "QR code du lien d'accès" })).toBeVisible();
  await expect(creation.dialog).toContainText(/Valable jusqu'au .+, une seule fois\./);
  await creation.button('Terminé').click();

  await expect(creation.dialog).toHaveCount(0);
  await expect(
    page.getByRole('table', { name: 'MJ de la convention' }).locator('tbody th a'),
  ).toHaveText(['Élodie']);
});

test('« Voir sa fiche » ouvre l’onglet « Compte » du pseudo créé, en attente de son lien', async ({
  page,
}) => {
  await page.goto('/gestion/participants');
  await page.getByRole('button', { name: 'Créer un pseudo' }).click();
  const creation = wizard(page);

  await creation.nickname.fill('Lune');
  await creation.button('Suivant').click();
  await creation.role('Organisateur').check();
  await creation.button('Créer le pseudo et son compte').click();
  await creation.button('Voir sa fiche').click();

  await expect(page.getByRole('heading', { level: 1, name: 'Lune' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Compte/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/^En attente/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Organisateur/ })).toBeChecked();
});

test('sans rôle, l’assistant crée un simple participant et ouvre sa fiche, sans lien (ID-12)', async ({
  page,
}) => {
  await page.goto('/gestion/participants');
  await page.getByRole('button', { name: 'Créer un pseudo' }).click();
  const creation = wizard(page);

  await creation.nickname.fill('Sven');
  await creation.button('Suivant').click();
  await creation.button('Créer le pseudo').click();

  await expect(creation.dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Sven' })).toBeVisible();
  await expect(page.getByText('Participant', { exact: true })).toBeVisible();
});

test('un pseudo déjà pris est refusé, avec un lien vers l’onglet « Compte » de sa fiche (ID-4, ID-7)', async ({
  page,
}) => {
  await addGameMaster(page.request, 'Kaïros');
  await page.goto('/gestion/participants');
  await page.getByRole('button', { name: 'Créer un pseudo' }).click();
  const creation = wizard(page);

  await creation.nickname.fill('kairos');
  await creation.button('Suivant').click();
  await creation.button('Créer le pseudo').click();

  await expect(creation.nickname).toBeFocused();
  await expect(creation.nickname).toHaveAccessibleDescription(
    /^Le MJ «\s*Kaïros\s*» porte déjà ce pseudo/,
  );
  await creation.dialog.getByRole('link', { name: 'Voir sa fiche' }).click();

  await expect(creation.dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Kaïros' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Compte/ })).toHaveAttribute('aria-selected', 'true');
});
