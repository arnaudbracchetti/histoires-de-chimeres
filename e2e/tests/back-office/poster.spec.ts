import { apiUrl, conventionEndpoints, type ConventionDto } from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

test('les Informations de connexion, par le rail puis par « Créneaux et tables » (ID-15)', async ({
  page,
  baseURL,
}) => {
  const convention = (await (
    await page.request.get(apiUrl(conventionEndpoints.read))
  ).json()) as ConventionDto;
  await page.goto('/gestion/');

  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Informations de connexion' })
    .click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Informations de connexion');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: convention.name })).toBeVisible();
  await expect(main.getByText(convention.presenceCode, { exact: true })).toBeVisible();
  // Le domaine seul, sans `https://` : celui du serveur e2e.
  await expect(main.getByText(new URL(baseURL!).host, { exact: true })).toBeVisible();
  const qrCode = main.getByRole('img', { name: /^QR code/ });
  await expect(qrCode).toBeVisible();
  await expect(qrCode.locator('path')).toHaveAttribute('d', /^M/);

  await page.goto('/gestion/creneaux-et-tables');
  await page.getByRole('link', { name: "Imprimé en clair sous le QR code de l'affiche." }).click();

  await expect(page).toHaveURL(/\/gestion\/informations-de-connexion$/);
  await expect(page.getByRole('main').getByRole('img', { name: /^QR code/ })).toBeVisible();
});
