import type { Page } from '@playwright/test';
import { apiUrl, tableEndpoints } from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

// Espace insécable (U+00A0) et espace fine insécable (U+202F) de docs/design/ton.md.
const NBSP = ' ';
const THIN = ' ';

async function addThroughApi(page: Page, ...names: string[]) {
  for (const name of names) {
    const response = await page.request.post(apiUrl(tableEndpoints.add), { data: { name } });
    expect(response.ok()).toBe(true);
  }
}

function room(page: Page) {
  // La page a aussi le formulaire de la convention et les créneaux, avec leurs boutons.
  const section = page.getByRole('region', { name: 'Tables' });
  const list = section.getByRole('list', { name: 'Tables de la convention' });
  const editor = list.locator('article.editing');
  return {
    button: (name: string) => section.getByRole('button', { name, exact: true }),
    /** Les noms des cartes affichées, hors carte en saisie. */
    names: list.locator('article.card:not(.editing) h3'),
    card: (name: string) => list.getByRole('article', { name, exact: true }),
    editor,
    input: editor.getByRole('textbox'),
  };
}

test('ajouter des tables à la chaîne, et les voir dans l’ordre naturel', async ({ page }) => {
  await page.goto('/gestion/creneaux-et-tables');
  const tables = room(page);

  await tables.button('Ajouter une table').click();
  for (const [saved, name] of ['Table 10', 'Table 2', 'Dragon', 'Table 1'].entries()) {
    await expect(tables.input).toBeFocused();
    await tables.input.fill(name);
    await page.keyboard.press('Enter');
    // La carte suivante s'ouvre une fois la précédente enregistrée, vide.
    await expect(tables.names).toHaveCount(saved + 1);
    await expect(tables.input).toHaveValue('');
  }
  await page.keyboard.press('Escape');

  await expect(tables.editor).toHaveCount(0);
  await expect(tables.button('Ajouter une table')).toBeFocused();
  await expect(tables.names).toHaveText(['Dragon', 'Table 1', 'Table 2', 'Table 10']);
  await page.reload();
  await expect(tables.names).toHaveText(['Dragon', 'Table 1', 'Table 2', 'Table 10']);
});

test('un nom déjà pris est refusé, à la casse et aux accents près (PR-9)', async ({ page }) => {
  await addThroughApi(page, 'Dragon');
  await page.goto('/gestion/creneaux-et-tables');
  const tables = room(page);

  await tables.button('Ajouter une table').click();
  await tables.input.fill(' dragón ');
  await tables.button('Ajouter la table').click();

  await expect(tables.input).toBeFocused();
  await expect(tables.input).toHaveAccessibleDescription(
    `La table «${NBSP}Dragon${NBSP}» porte déjà ce nom${NBSP}: choisis-en un autre.`,
  );
  await expect(tables.names).toHaveText(['Dragon']);
});

test('renommer une table par « Modifier »', async ({ page }) => {
  await addThroughApi(page, 'Table 1', 'Table 2');
  await page.goto('/gestion/creneaux-et-tables');
  const tables = room(page);

  await tables.button('Modifier la table Table 1').click();
  await expect(tables.input).toHaveValue('Table 1');
  await tables.input.fill('Table 3');
  await tables.button('Enregistrer').click();

  await expect(tables.editor).toHaveCount(0);
  await expect(tables.names).toHaveText(['Table 2', 'Table 3']);
  await expect(tables.card('Table 3')).toBeFocused();
  await page.reload();
  await expect(tables.names).toHaveText(['Table 2', 'Table 3']);
});

test('supprimer une table après confirmation ; « Annuler » ne supprime rien', async ({ page }) => {
  await addThroughApi(page, 'Dragon', 'Licorne');
  await page.goto('/gestion/creneaux-et-tables');
  const tables = room(page);
  const dialog = page.getByRole('alertdialog', {
    name: `Supprimer la table «${NBSP}Dragon${NBSP}»${THIN}?`,
  });
  const askRemoval = () => tables.button('Supprimer la table Dragon').click();

  await askRemoval();
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toBeHidden();
  await expect(tables.names).toHaveText(['Dragon', 'Licorne']);

  await askRemoval();
  await dialog.getByRole('button', { name: 'Supprimer la table' }).click();

  await expect(dialog).toBeHidden();
  await expect(tables.names).toHaveText(['Licorne']);
  await expect(tables.card('Licorne')).toBeFocused();
  await page.reload();
  await expect(tables.names).toHaveText(['Licorne']);
});

test('une erreur ne décale rien : les cartes et leurs boutons restent en place', async ({
  page,
}) => {
  await addThroughApi(page, 'Dragon');
  await page.goto('/gestion/creneaux-et-tables');
  const tables = room(page);
  await tables.button('Ajouter une table').click();
  const cancel = await tables.button('Annuler').boundingBox();
  const editor = await tables.editor.boundingBox();
  const dragon = await tables.card('Dragon').boundingBox();

  await tables.input.fill('');
  await tables.button('Ajouter la table').click();

  await expect(tables.input).toHaveAccessibleDescription('Donne un nom à la table.');
  expect(await tables.button('Annuler').boundingBox()).toEqual(cancel);
  expect(await tables.editor.boundingBox()).toEqual(editor);
  expect(await tables.card('Dragon').boundingBox()).toEqual(dragon);
});
