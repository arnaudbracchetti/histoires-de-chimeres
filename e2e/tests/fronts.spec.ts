import { expect, test } from '@playwright/test';

test('le front office souhaite la bienvenue', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Bienvenue à Histoires de Chimères',
  );
});

test('le back office est servi sous /gestion/', async ({ page }) => {
  await page.goto('/gestion');

  await expect(page).toHaveURL(/\/gestion\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Gestion — Histoires de Chimères',
  );
});

test('les liens profonds retombent sur le bon front', async ({ page }) => {
  await page.goto('/gestion/une/route');
  await expect(page).toHaveTitle('Gestion — Histoires de Chimères');

  await page.goto('/une/route');
  await expect(page).toHaveTitle('Histoires de Chimères');
});
