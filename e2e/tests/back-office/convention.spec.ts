import {
  apiUrl,
  conventionEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type UpdateConventionBody,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

// Espace insécable (U+00A0) de docs/design/ton.md.
const NBSP = '\u00a0';

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

test('la carte de la convention montre sa fin et son code de présence', async ({ page }) => {
  const convention = (await (
    await page.request.get(apiUrl(conventionEndpoints.read))
  ).json()) as ConventionDto;
  await page.goto('/gestion/creneaux-et-tables');
  await expect(page.getByText('Pas de fin')).toBeVisible();
  await expect(page.getByText(convention.presenceCode, { exact: true })).toBeVisible();

  for (const hours of [
    { start: '09:00', end: '11:30' },
    { start: '14:00', end: '18:30' },
  ]) {
    expect((await page.request.post(apiUrl(timeSlotEndpoints.add), { data: hours })).ok()).toBe(
      true,
    );
  }
  await page.reload();
  await page.getByLabel('Date').fill('2027-03-13');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText(`samedi 13 mars 2027 à 18${NBSP}h${NBSP}30`)).toBeVisible();
  await expect(page.getByText('À la fin du dernier créneau (créneau 2)')).toBeVisible();
});
