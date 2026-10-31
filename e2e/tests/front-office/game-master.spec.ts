import { expect, test } from '@playwright/test';
import { identifyAsGameMaster } from './identification.js';
import { gameCard, prepare, scheduleTab, timeSlotChip } from './schedule.js';

test('Mes parties déplie la partie que mène le MJ, sur ses deux créneaux (§5.7)', async ({
  page,
}) => {
  const { kairos, epice } = await prepare(page);
  await identifyAsGameMaster(page, kairos.nickname);

  await page.goto('/mes-parties');
  for (const rank of [1, 2]) {
    const timeSlot = page.getByRole('region', { name: new RegExp(`^Créneau ${rank}\\b`) });
    const led = timeSlot.locator('app-led-game-card');
    await expect(led).toContainText('Tu mènes');
    await expect(led).toContainText(`Table ${epice.tableName}`);
    await expect(led).toContainText('Aucun inscrit · 4 à 6 places');
  }

  await page
    .getByRole('region', { name: /^Créneau 1\b/ })
    .getByRole('link', { name: epice.title })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(epice.title);
  await expect(page.getByText('Tu mènes cette partie')).toBeVisible();
  await page.getByRole('link', { name: 'Voir dans Mes parties' }).click();
  await expect(page).toHaveURL(/\/mes-parties\?creneau=1$/);
});

test('le MJ ne peut pas s’inscrire sur un créneau où il mène, et le programme dit pourquoi (IN-4)', async ({
  page,
}) => {
  const { kairos, brumes, epice } = await prepare(page);
  await identifyAsGameMaster(page, kairos.nickname);

  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();
  await expect(timeSlotChip(page, 1)).toHaveAccessibleName(/tu mènes$/);
  await expect(
    page.getByText(
      `Tu mènes ${epice.title} à la table ${epice.tableName} : tu ne peux pas t'inscrire comme joueur sur ce créneau.`,
    ),
  ).toBeVisible();

  await gameCard(page, brumes.title).click();
  await expect(page.getByText('Tu mènes une partie sur ce créneau')).toBeVisible();
  await expect(
    page.getByText(
      `${epice.title}, table ${epice.tableName} : tu ne peux pas t'inscrire comme joueur.`,
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: "S'inscrire" })).toHaveCount(0);
});
