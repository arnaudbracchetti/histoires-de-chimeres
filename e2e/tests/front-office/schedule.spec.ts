import { expect, test, type Page } from '@playwright/test';
import { aNickname, identify } from './identification.js';
import { gameCard, prepare, scheduleTab, timeSlotChip } from './schedule.js';

test('le programme montre les parties créneau par créneau, une partie double sous son seul premier créneau (IN-3)', async ({
  page,
}) => {
  const { brann, brumes, epice } = await prepare(page);
  await identify(page, aNickname('Élodie'));

  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();

  await expect(timeSlotChip(page, 1)).toHaveAttribute('aria-current', 'true');
  const card = gameCard(page, brumes.title);
  await expect(card).toContainText(`Table ${brumes.tableName}`);
  await expect(card).toContainText(`L'Appel de Cthulhu · avec ${brann.nickname}`);
  await expect(card).toContainText(/Aucun inscrit · 5.places/);
  await expect(gameCard(page, epice.title)).toContainText('créneaux 1 et 2');

  await timeSlotChip(page, 2).click();
  await expect(timeSlotChip(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(gameCard(page, epice.title)).toHaveCount(0);
  await expect(gameCard(page, brumes.title)).toHaveCount(0);
});

test('la fiche d’une partie montre son contenu dans l’ordre du §5.3, puis revient au programme', async ({
  page,
}) => {
  const { kairos, brumes, epice } = await prepare(page);
  await identify(page, aNickname('Élodie'));
  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();

  await gameCard(page, brumes.title).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(brumes.title);
  await expect(page.getByText(/^Créneau 1 · \d.* · table /)).toBeVisible();
  await expect(page.getByText(/Aucun inscrit · 5.places/)).toBeVisible();
  const warnings = page.getByRole('region', { name: 'Avertissements de contenu' });
  await expect(warnings).toHaveText(/Noyade\./);
  await expect(page.locator('strong', { hasText: 'sous' })).toBeVisible();
  // Les avertissements de contenu se lisent avant la présentation (§5.3).
  const top = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!.y;
  expect(await top(warnings)).toBeLessThan(await top(page.getByText(/Une enquête/)));

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(timeSlotChip(page, 1)).toHaveAttribute('aria-current', 'true');

  await gameCard(page, epice.title).click();
  await expect(page.getByText(/^Créneaux 1 et 2 · \d/)).toBeVisible();
  await expect(page.getByText(`Dune · avec ${kairos.nickname}`)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Avertissements de contenu' })).toHaveCount(0);
});
