import type { Page } from '@playwright/test';
import { apiUrl, timeSlotEndpoints, type TimeSlotHoursBody } from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

// Espace insécable (U+00A0) et espace fine insécable (U+202F) de docs/design/ton.md.
const NBSP = ' ';
const THIN = ' ';

/** « 14 h 00 ». */
const time = (hours: number, minutes = '00') => `${hours}${NBSP}h${NBSP}${minutes}`;
/** « Créneau 2 · 14 h 00 – 16 h 30 ». */
const slot = (rank: number, start: string, end: string) =>
  `Créneau ${rank} · ${start}${THIN}–${THIN}${end}`;

async function addThroughApi(page: Page, ...slots: TimeSlotHoursBody[]) {
  for (const data of slots) {
    const response = await page.request.post(apiUrl(timeSlotEndpoints.add), { data });
    expect(response.ok()).toBe(true);
  }
}

function day(page: Page) {
  // La page a aussi le formulaire de la convention, et son « Enregistrer ».
  const section = page.getByRole('region', { name: 'Créneaux' });
  const list = section.getByRole('list', { name: 'Créneaux de la journée' });
  const editor = list.locator('article.editing');
  return {
    button: (name: string) => section.getByRole('button', { name, exact: true }),
    /** Les cartes affichées, en « Créneau N · plage ». */
    schedule: () =>
      list
        .locator('article.card:not(.editing)')
        .evaluateAll((cards) =>
          cards.map(
            (card) =>
              `${card.querySelector('h3')?.textContent?.trim()} · ${card.querySelector('.range')?.textContent?.trim()}`,
          ),
        ),
    cards: list.locator('article.card:not(.editing)'),
    pauses: list.locator('.pause'),
    editor,
    start: editor.getByLabel('Début'),
    end: editor.getByLabel('Fin'),
  };
}

test('ajouter quatre créneaux à la chaîne, avec les heures proposées, et voir les rangs', async ({
  page,
}) => {
  await page.goto('/gestion/creneaux-et-tables');
  const slots = day(page);

  await slots.button('Ajouter un créneau').click();
  await slots.start.fill('9h');
  for (const saved of [1, 2, 3, 4]) {
    await expect(slots.start).toBeFocused();
    await slots.button('Ajouter le créneau').click();
    // La carte suivante s'ouvre une fois la précédente enregistrée, début à sa fin.
    await expect(slots.cards).toHaveCount(saved);
  }
  await slots.button('Annuler').click();

  await expect(slots.editor).toHaveCount(0);
  expect(await slots.schedule()).toEqual([
    slot(1, time(9), time(11, '30')),
    slot(2, time(11, '30'), time(14)),
    slot(3, time(14), time(16, '30')),
    slot(4, time(16, '30'), time(19)),
  ]);
  await expect(slots.pauses).toHaveText(['bout à bout', 'bout à bout', 'bout à bout']);
});

test('insérer un créneau avant les autres, et voir les rangs recalculés', async ({ page }) => {
  await addThroughApi(page, { start: '14:00', end: '16:30' }, { start: '17:00', end: '19:30' });
  await page.goto('/gestion/creneaux-et-tables');
  const slots = day(page);

  await slots.button('Ajouter un créneau').click();
  await slots.start.fill('09:00');
  await page.keyboard.press('Enter');
  await expect(slots.cards).toHaveCount(3);
  await page.keyboard.press('Escape');

  expect(await slots.schedule()).toEqual([
    slot(1, time(9), time(11, '30')),
    slot(2, time(14), time(16, '30')),
    slot(3, time(17), time(19, '30')),
  ]);
  await expect(slots.pauses).toHaveText([`pause de 2${NBSP}h${NBSP}30`, `pause de 30${NBSP}min`]);
});

test('un chevauchement est refusé sous son champ', async ({ page }) => {
  await addThroughApi(page, { start: '14:00', end: '16:30' });
  await page.goto('/gestion/creneaux-et-tables');
  const slots = day(page);

  await slots.button('Ajouter un créneau').click();
  await slots.start.fill('12:00');
  await page.keyboard.press('Enter');

  await expect(slots.end).toBeFocused();
  await expect(slots.end).toHaveAccessibleDescription(
    `Ce créneau empiète sur le créneau 1${NBSP}: avance sa fin.`,
  );
  await expect(slots.cards).toHaveCount(1);
});

test('changer les heures d’un créneau', async ({ page }) => {
  await addThroughApi(page, { start: '09:00', end: '11:30' }, { start: '14:00', end: '16:30' });
  await page.goto('/gestion/creneaux-et-tables');
  const slots = day(page);

  await slots.button('Modifier le créneau 1').click();
  await expect(slots.editor).toContainText('Modifier le créneau 1');
  await slots.start.fill('17h');
  await slots.end.fill('19:00');
  await slots.button('Enregistrer').click();

  await expect(slots.editor).toHaveCount(0);
  expect(await slots.schedule()).toEqual([
    slot(1, time(14), time(16, '30')),
    slot(2, time(17), time(19)),
  ]);
  await page.reload();
  await expect(slots.cards.last()).toContainText(time(19));
});

test('supprimer un créneau après confirmation ; « Annuler » ne supprime rien', async ({ page }) => {
  await addThroughApi(page, { start: '09:00', end: '11:30' }, { start: '14:00', end: '16:30' });
  await page.goto('/gestion/creneaux-et-tables');
  const slots = day(page);
  const dialog = page.getByRole('alertdialog', { name: 'Supprimer le créneau 1 ?' });

  await slots.button('Supprimer le créneau 1').click();
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toBeHidden();
  await expect(slots.button('Supprimer le créneau 1')).toBeFocused();
  await expect(slots.cards).toHaveCount(2);

  await slots.button('Supprimer le créneau 1').click();
  await dialog.getByRole('button', { name: 'Supprimer le créneau' }).click();

  await expect(dialog).toBeHidden();
  expect(await slots.schedule()).toEqual([slot(1, time(14), time(16, '30'))]);
  await expect(slots.cards.first()).toBeFocused();
  await page.reload();
  await expect(slots.cards).toHaveCount(1);
});

test('une erreur ne décale rien : les boutons de la carte restent en place', async ({ page }) => {
  await page.goto('/gestion/creneaux-et-tables');
  const slots = day(page);
  await slots.button('Ajouter un créneau').click();
  const before = await slots.button('Annuler').boundingBox();
  const duration = slots.editor.locator('.duration');
  const durationBefore = await duration.boundingBox();

  await slots.start.fill('25:00');
  await slots.end.fill('');
  await slots.button('Ajouter le créneau').click();

  await expect(slots.start).toHaveAccessibleDescription(
    "Écris l'heure sur 24 heures, de 00:00 à 23:59.",
  );
  await expect(slots.end).toHaveAccessibleDescription("Indique l'heure de fin.");
  expect(await slots.button('Annuler').boundingBox()).toEqual(before);
  expect(await duration.boundingBox()).toEqual(durationBefore);
});

test('quitter un champ vide pour « Annuler » n’affiche aucune erreur', async ({ page }) => {
  await page.goto('/gestion/creneaux-et-tables');
  const slots = day(page);
  await slots.button('Ajouter un créneau').click();
  await slots.start.fill('');

  await slots.button('Annuler').click();

  await expect(slots.editor).toHaveCount(0);
  await expect(slots.button('Ajouter un créneau')).toBeFocused();
});
