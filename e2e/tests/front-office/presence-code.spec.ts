import { expect, test, type Page } from '@playwright/test';
import {
  apiUrl,
  conventionEndpoints,
  PRESENCE_CODE_PARAM,
  type ConventionDto,
} from '@chimeres/contract';

/** Le code de présence, lu dans le DTO de la convention. */
async function presenceCode(page: Page): Promise<string> {
  const response = await page.request.get(apiUrl(conventionEndpoints.read));
  expect(response.ok()).toBe(true);
  return ((await response.json()) as ConventionDto).presenceCode;
}

/** Le code accepté, l'application demande le pseudo. */
const welcome = (page: Page) =>
  expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');

test('le code de présence du QR code ouvre le front office, et reste gardé (ID-2)', async ({
  page,
}) => {
  const code = await presenceCode(page);

  await page.goto(`/?${PRESENCE_CODE_PARAM}=${code}`);

  await welcome(page);
  await expect(page).toHaveURL((url) => !url.searchParams.has(PRESENCE_CODE_PARAM));
  await page.goto('/');
  await welcome(page);
});

test('sans code, le front office le demande, refuse un code faux, et accepte les minuscules (ID-2)', async ({
  page,
}) => {
  const code = await presenceCode(page);
  const wrong = (code.startsWith('A') ? 'B' : 'A') + code.slice(1);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Code de présence');
  await expect(page.getByText('sous le QR code')).toBeVisible();

  const field = page.getByLabel('Code', { exact: true });
  await field.fill(wrong);
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(field).toHaveAccessibleDescription(
    "Ce code ne correspond pas. Vérifie-le sur l'affiche, sous le QR code.",
  );

  await field.fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Entrer' }).click();
  await welcome(page);
});
