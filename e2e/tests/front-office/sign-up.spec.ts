import { expect, test } from '@playwright/test';
import { aNickname, identify } from './identification.js';
import {
  gameCard,
  prepare,
  scheduleTab,
  signUpFromAnotherPhone,
  timeSlotChip,
} from './schedule.js';

test('confirme avant de s’inscrire à une partie très demandée : annuler, voir les autres parties, s’inscrire quand même (IN-5)', async ({
  page,
  request,
}) => {
  const { brumes } = await prepare(page, { brumesSeats: { min: 1, max: 1 } });
  await signUpFromAnotherPhone(request, brumes.title);
  await identify(page, aNickname('Élodie'));
  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();
  await gameCard(page, brumes.title).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Partie très demandée' });

  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(confirmation).toContainText(
    new RegExp(
      `^Partie très demandée${brumes.title} a déjà 1.inscrit pour 1.place.: tu risques de ne pas avoir de place\\. Inscris-toi aussi à d'autres parties du créneau 1, pour avoir plus de chances de jouer\\.`,
    ),
  );
  await confirmation.getByRole('button', { name: 'Annuler' }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole('button', { name: "S'inscrire" })).toBeVisible();
  await expect(page.getByText(/^1.inscrit · 1.place$/)).toBeVisible();

  await page.getByRole('button', { name: "S'inscrire" }).click();
  await confirmation.getByRole('button', { name: 'Voir les autres parties' }).click();
  await expect(page).toHaveURL(/\/programme\?creneau=1$/);
  await expect(timeSlotChip(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect(gameCard(page, brumes.title)).toContainText(/1.inscrit · 1.place/);
  await expect(gameCard(page, brumes.title)).not.toContainText(/Inscrit\b/);

  await gameCard(page, brumes.title).click();
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await confirmation.getByRole('button', { name: "S'inscrire quand même" }).click();
  await expect(page.getByText('Inscription enregistrée')).toBeVisible();
  await expect(page.getByText(/^2.inscrits · 1.place$/)).toBeVisible();
});

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
