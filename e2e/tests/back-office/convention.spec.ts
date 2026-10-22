import { apiUrl, conventionEndpoints, type UpdateConventionBody } from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

test('renommer la convention et fixer sa date, puis les voir dans le rail', async ({ page }) => {
  await page.goto('/gestion/creneaux-et-tables');
  const rail = page.getByRole('link', { name: /Histoires de Chimères/ });
  await expect(rail).toContainText('date à fixer');

  await page.getByLabel('Nom').fill('Chimères 2027');
  await page.getByLabel('Date').fill('2027-03-13');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();
  const convention = page.locator('a.convention');
  await expect(convention).toContainText('Chimères 2027');
  await expect(convention).toContainText('samedi 13 mars 2027');

  await page.reload();
  await expect(page.getByLabel('Nom')).toHaveValue('Chimères 2027');
  await expect(convention).toContainText('samedi 13 mars 2027');
});

test('effacer la date de la convention', async ({ page }) => {
  const body: UpdateConventionBody = { name: 'Chimères 2027', date: '2027-03-13' };
  const prepared = await page.request.put(apiUrl(conventionEndpoints.update), { data: body });
  expect(prepared.ok()).toBe(true);
  await page.goto('/gestion/creneaux-et-tables');
  const convention = page.locator('a.convention');
  await expect(convention).toContainText('samedi 13 mars 2027');

  await page.getByLabel('Date').fill('');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(convention).toContainText('date à fixer');
});

test('un nom vide est signalé sous le champ, sans rien envoyer', async ({ page }) => {
  await page.goto('/gestion/creneaux-et-tables');
  const name = page.getByLabel('Nom');

  const save = page.getByRole('button', { name: 'Enregistrer' });
  const before = await save.boundingBox();
  await name.fill('');
  await save.click();

  await expect(name).toBeFocused();
  await expect(name).toHaveAccessibleDescription('Donne un nom à la convention.');
  // L'erreur s'écrit sur une ligne réservée : elle ne décale rien.
  expect(await save.boundingBox()).toEqual(before);
  await expect(page.locator('a.convention')).toContainText('Histoires de Chimères');
});
