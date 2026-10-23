import type { Page } from '@playwright/test';
import {
  apiUrl,
  availabilityEndpoints,
  gameMasterEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

// Espace insécable (U+00A0) et espace fine insécable (U+202F) de docs/design/ton.md.
const NBSP = ' ';
const THIN = ' ';

/** « 14 h 00 ». */
const time = (hours: number, minutes = '00') => `${hours}${NBSP}h${NBSP}${minutes}`;
/** « Créneau 2 · 14 h 00 – 16 h 30 ». */
const slot = (rank: number, start: string, end: string) =>
  `Créneau ${rank} · ${start}${THIN}–${THIN}${end}`;

/**
 * Par l'API : créneau 1 de 9 h à 11 h 30, créneau 2 de 14 h à 16 h 30, MJ « Élodie » et
 * « Kaïros ». Renvoie les identifiants.
 */
async function prepare(page: Page) {
  let convention: ConventionDto | undefined;
  for (const data of [
    { start: '09:00', end: '11:30' },
    { start: '14:00', end: '16:30' },
  ]) {
    const response = await page.request.post(apiUrl(timeSlotEndpoints.add), { data });
    expect(response.ok()).toBe(true);
    convention = await response.json();
  }
  let gameMasters: GameMasterDto[] = [];
  for (const nickname of ['Élodie', 'Kaïros']) {
    const response = await page.request.post(apiUrl(gameMasterEndpoints.add), {
      data: { nickname },
    });
    expect(response.ok()).toBe(true);
    gameMasters = await response.json();
  }
  const [slot1, slot2] = convention!.timeSlots.map(({ id }) => id) as [string, string];
  const [elodie, kairos] = gameMasters.map(({ id }) => id) as [string, string];
  return { slot1, slot2, elodie, kairos };
}

async function declareThroughApi(page: Page, gameMasterId: string, timeSlotId: string) {
  const response = await page.request.put(
    apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId }),
  );
  expect(response.ok()).toBe(true);
}

test('cliquer sur les créneaux de la frise du MJ, enregistrés sans bouton (PR-2)', async ({
  page,
}) => {
  const { elodie } = await prepare(page);
  await page.goto(`/gestion/mj/${elodie}`);
  const first = page.getByRole('checkbox', { name: slot(1, time(9), time(11, '30')) });
  const second = page.getByRole('checkbox', { name: slot(2, time(14), time(16, '30')) });
  /** Le bloc de la frise qui porte la case : c'est lui qu'on clique. */
  const block = (box: typeof first) => page.locator('label.block').filter({ has: box });
  await expect(block(first)).toContainText('Pas disponible');

  await block(first).click();
  await block(second).click();
  await expect(page.locator('label.pending')).toHaveCount(0);
  await expect(block(first)).toContainText('Je peux mener une partie');
  await block(second).click();
  await expect(page.locator('label.pending')).toHaveCount(0);

  await page.reload();
  await expect(first).toBeChecked();
  await expect(second).not.toBeChecked();
  await page.getByRole('link', { name: 'MJ', exact: true }).first().click();
  await expect(page.getByRole('row', { name: /Élodie/ })).toContainText('Créneau 1');
});

test('les heures d’un créneau qui porte une disponibilité sont refusées (PR-11)', async ({
  page,
}) => {
  const { slot2, elodie, kairos } = await prepare(page);
  await declareThroughApi(page, elodie, slot2);
  await declareThroughApi(page, kairos, slot2);
  await page.goto('/gestion/creneaux-et-tables');
  const section = page.getByRole('region', { name: 'Créneaux' });

  await section.getByRole('button', { name: 'Modifier le créneau 2', exact: true }).click();
  await section.getByLabel('Début').fill('15:00');
  await section.getByLabel('Fin').fill('17:00');
  await section.getByRole('button', { name: 'Enregistrer', exact: true }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Heures figées' });
  await expect(alert).toContainText(
    `2 MJ sont disponibles sur le créneau 2${NBSP}: ses heures ne changent plus.`,
  );
  await page.reload();
  await expect(section.locator('article.card').last()).toContainText(time(14));
});

test('supprimer un créneau supprime ses disponibilités, annoncées dans la confirmation (PR-10)', async ({
  page,
}) => {
  const { slot1, slot2, elodie, kairos } = await prepare(page);
  await declareThroughApi(page, elodie, slot1);
  await declareThroughApi(page, elodie, slot2);
  await declareThroughApi(page, kairos, slot1);
  await page.goto('/gestion/creneaux-et-tables');
  const section = page.getByRole('region', { name: 'Créneaux' });

  await section.getByRole('button', { name: 'Supprimer le créneau 1', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: `Supprimer le créneau 1${THIN}?` });
  await expect(dialog).toContainText('Ses 2 disponibilités seront supprimées.');
  await dialog.getByRole('button', { name: 'Supprimer le créneau' }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/gestion/mj/${elodie}`);
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await expect(
    page.getByRole('checkbox', { name: slot(1, time(14), time(16, '30')) }),
  ).toBeChecked();
  await page.goto(`/gestion/mj/${kairos}`);
  await expect(
    page.getByRole('checkbox', { name: slot(1, time(14), time(16, '30')) }),
  ).not.toBeChecked();
});
