import { expect, test } from '@playwright/test';
import { aNickname, identify } from './identification.js';
import { gameCard, prepare, scheduleTab, timeSlotChip } from './schedule.js';

test('s’inscrire depuis la fiche, puis se désinscrire d’un tap (IN-2)', async ({ page }) => {
  const { brumes } = await prepare(page);
  await identify(page, aNickname('Élodie'));
  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();
  await gameCard(page, brumes.title).click();

  await page.getByRole('button', { name: "S'inscrire" }).click();

  await expect(page.getByText('Inscription enregistrée')).toBeVisible();
  await expect(page.getByText(/^1.inscrit · 5.places$/)).toBeVisible();

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(gameCard(page, brumes.title)).toContainText('Inscrit');
  await expect(gameCard(page, brumes.title)).toContainText(/1.inscrit · 5.places/);

  await gameCard(page, brumes.title).click();
  await page.getByRole('button', { name: 'Se désinscrire' }).click();

  await expect(page.getByRole('button', { name: "S'inscrire" })).toBeVisible();
  await expect(page.getByText(/^Aucun inscrit · 5.places$/)).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(gameCard(page, brumes.title)).not.toContainText(/Inscrit\b/);
});
