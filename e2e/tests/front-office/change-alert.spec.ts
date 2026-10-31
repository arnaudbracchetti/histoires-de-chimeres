import { expect, test } from '@playwright/test';
import { apiUrl, scheduleEndpoints, signUpEndpoints } from '@chimeres/contract';
import { aNickname, identify } from './identification.js';
import { prepare, timeSlotChip } from './schedule.js';

test('signale une inscription retirée par le back office, et « Voir » ouvre les parties du créneau (NO-5)', async ({
  page,
  request,
}) => {
  const { brumes } = await prepare(page);
  await identify(page, aNickname('Élodie'));
  const signUp = await page.request.put(apiUrl(signUpEndpoints.signUp, { gameId: brumes.gameId }));
  expect(signUp.ok()).toBe(true);
  // L'Accueil lit l'inscription : la lecture suivante se comparera à celle-ci.
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Ton programme' })).toContainText(brumes.title);

  // L'Organisateur retire la partie du programme, depuis le back office.
  expect(
    (await request.delete(apiUrl(scheduleEndpoints.unschedule, { gameId: brumes.gameId }))).ok(),
  ).toBe(true);
  // Changer d'écran relit les données.
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Mes parties' })
    .click();

  const alert = page.getByRole('alert').filter({ hasText: 'partie retirée du programme' });
  await expect(alert.getByText(/^Créneau 1.: partie retirée du programme$/)).toBeVisible();
  await expect(
    alert.getByText(new RegExp(`^${brumes.title} est retirée.: ton inscription est supprimée\\.$`)),
  ).toBeVisible();
  // Elle reste à l'écran d'une relecture à l'autre.
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Accueil' })
    .click();
  await expect(alert).toBeVisible();

  await alert.getByRole('button', { name: 'Voir' }).click();
  await expect(page).toHaveURL(/\/programme\?creneau=1$/);
  await expect(timeSlotChip(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect(alert).toBeHidden();
});
