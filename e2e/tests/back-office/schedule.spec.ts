import type { Page } from '@playwright/test';
import {
  apiUrl,
  availabilityEndpoints,
  gameMasterEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type ScenarioDto,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

// Espace insécable (U+00A0) et espace fine insécable (U+202F) de docs/design/ton.md.
const NBSP = ' ';
const THIN = ' ';

/** « Créneau 2 · 14 h 00 – 16 h 30, Table 1 » : le nom accessible d'un « Choisir ». */
const cell = (rank: number, start: number, table: string) =>
  `Choisir Créneau ${rank} · ${start}${NBSP}h${NBSP}00${THIN}–${THIN}${start + 2}${NBSP}h${NBSP}30, ${table}`;

async function post(page: Page, url: string, data: object) {
  const response = await page.request.post(url, { data });
  expect(response.ok()).toBe(true);
  return response.json();
}

/**
 * Par l'API : créneaux 1 (9 h – 11 h 30) et 2 (14 h – 16 h 30), sans table ni MJ.
 */
async function prepareTimeSlots(page: Page): Promise<ConventionDto> {
  await post(page, apiUrl(timeSlotEndpoints.add), { start: '09:00', end: '11:30' });
  return post(page, apiUrl(timeSlotEndpoints.add), { start: '14:00', end: '16:30' });
}

/**
 * Par l'API, en plus des créneaux : tables « Table 1 » et « Table 2 ». « Élodie », disponible sur
 * les deux créneaux, propose « Néons » et « Ruines » ; « Kaïros », disponible sur le créneau 1,
 * propose « Brumes ».
 */
async function prepare(page: Page) {
  await prepareTimeSlots(page);
  let convention: ConventionDto | undefined;
  for (const name of ['Table 1', 'Table 2']) {
    convention = await post(page, apiUrl(tableEndpoints.add), { name });
  }
  let gameMasters: GameMasterDto[] = [];
  for (const nickname of ['Élodie', 'Kaïros']) {
    gameMasters = await post(page, apiUrl(gameMasterEndpoints.add), { nickname });
  }
  const [slot1, slot2] = convention!.timeSlots.map(({ id }) => id) as [string, string];
  const [elodie, kairos] = gameMasters.map(({ id }) => id) as [string, string];
  for (const [gameMasterId, timeSlotId] of [
    [elodie, slot1],
    [elodie, slot2],
    [kairos, slot1],
  ] as const) {
    const response = await page.request.put(
      apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId }),
    );
    expect(response.ok()).toBe(true);
  }
  const propose = (gameMasterId: string, title: string): Promise<ScenarioDto> =>
    post(page, apiUrl(scenarioEndpoints.propose, { gameMasterId }), {
      title,
      system: 'Cthulhu',
      presentation: 'Une enquête.',
      contentWarnings: '',
      seats: { min: 3, max: 5 },
      duration: 1,
    });
  const neons = await propose(elodie, 'Néons');
  await propose(elodie, 'Ruines');
  const brumes = await propose(kairos, 'Brumes');
  const tableId = (name: string) => convention!.tables.find((t) => t.name === name)!.id;
  return { slot1, slot2, neons, brumes, tableId };
}

const reserve = (page: Page) => page.getByRole('region', { name: 'Réserve' });
const placementDialog = (page: Page) => page.getByRole('dialog');

test('sans créneau, le Calendrier invite à les créer, ou à commencer par les MJ', async ({
  page,
}) => {
  await page.goto('/gestion/');

  await expect(page.getByText("Aucun créneau pour l'instant")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ou commencer par les MJ' })).toBeVisible();
  await page.getByRole('link', { name: 'Créer les créneaux' }).click();
  await expect(page).toHaveURL(/\/gestion\/creneaux-et-tables$/);
});

test('sans table, le Calendrier invite à les ajouter', async ({ page }) => {
  await prepareTimeSlots(page);
  await page.goto('/gestion/');

  await expect(page.getByText("Aucune table pour l'instant")).toBeVisible();
  await page.getByRole('link', { name: 'Ajouter les tables' }).click();
  await expect(page).toHaveURL(/\/gestion\/creneaux-et-tables$/);
});

test('la frise prend toute la largeur, chaque créneau au prorata de sa durée', async ({ page }) => {
  await post(page, apiUrl(timeSlotEndpoints.add), { start: '09:00', end: '11:30' });
  await post(page, apiUrl(timeSlotEndpoints.add), { start: '14:00', end: '19:00' });
  await post(page, apiUrl(tableEndpoints.add), { name: 'Table 1' });
  await page.goto('/gestion/');

  const frise = page.getByRole('table', { name: 'Programme, par table et par créneau' });
  const [short, long] = await frise
    .getByRole('columnheader', { name: /^Créneau/ })
    .evaluateAll((headers) => headers.map((header) => header.getBoundingClientRect().width));
  // 2 h 30 contre 5 h : la moitié, à l'espacement près.
  expect(short! / long!).toBeCloseTo(0.5, 1);
  const main = await page.locator('main').evaluate((element) => element.clientWidth);
  const width = await frise.evaluate((element) => element.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(main * 0.9);
});

test('le bac de réserve compte les scénarios de chaque créneau (PR-6)', async ({ page }) => {
  const { neons, slot1, tableId } = await prepare(page);
  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: neons.id,
    timeSlotId: slot1,
    tableId: tableId('Table 1'),
  });
  await page.goto('/gestion/');

  const filter = (rank: number) =>
    reserve(page).getByRole('button', { name: new RegExp(`^Créneau ${rank} `) });
  // Créneau 1 : Élodie y mène déjà « Néons » ; créneau 2 : Kaïros n'y est pas disponible.
  await expect(filter(1)).toHaveAccessibleName('Créneau 1 · 1 scénario');
  await expect(filter(2)).toHaveAccessibleName('Créneau 2 · 2 scénarios');
  await expect(reserve(page).getByRole('heading', { level: 3 })).toHaveText(['Brumes']);
  await filter(2).click();
  await expect(reserve(page).getByRole('heading', { level: 3 })).toHaveText(['Néons', 'Ruines']);
});

/** La carte d'un scénario dans le bac de réserve. */
const reserveCard = (page: Page, title: string) =>
  reserve(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: title }) });

test('« Tous les scénarios » donne une pastille par statut : programmé, en réserve', async ({
  page,
}) => {
  const { neons, slot1, tableId } = await prepare(page);
  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: neons.id,
    timeSlotId: slot1,
    tableId: tableId('Table 1'),
  });
  await page.goto('/gestion/');

  const all = reserve(page).getByRole('button', { name: /^Tous les scénarios / });
  await expect(all).toHaveAccessibleName('Tous les scénarios · 3 scénarios');
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(reserve(page).getByRole('heading', { level: 3 })).toHaveText([
    'Brumes',
    'Néons',
    'Ruines',
  ]);
  const pastilles = (title: string) =>
    reserveCard(page, title).getByRole('list', { name: 'Créneaux' }).getByRole('listitem');
  await expect(pastilles('Néons')).toHaveText([
    `Programmé${NBSP}: créneau 1`,
    `En réserve${NBSP}: créneau 2`,
  ]);
  await expect(pastilles('Ruines')).toHaveText([`En réserve${NBSP}: créneau 2`]);
  await expect(pastilles('Brumes')).toHaveText([`En réserve${NBSP}: créneau 1`]);
});

test("le scénario d'un MJ sans disponibilité est grisé, avec sa raison", async ({ page }) => {
  await prepare(page);
  const gameMasters: GameMasterDto[] = await post(page, apiUrl(gameMasterEndpoints.add), {
    nickname: 'Morgane',
  });
  const morgane = gameMasters.find(({ nickname }) => nickname === 'Morgane')!;
  await post(page, apiUrl(scenarioEndpoints.propose, { gameMasterId: morgane.id }), {
    title: 'Abysses',
    system: 'Cthulhu',
    presentation: 'Une enquête.',
    contentWarnings: '',
    seats: { min: 3, max: 5 },
    duration: 1,
  });
  await page.goto('/gestion/');

  await expect(reserveCard(page, 'Abysses')).toHaveCount(0);
  await reserve(page)
    .getByRole('button', { name: /^Tous les scénarios / })
    .click();
  const card = reserveCard(page, 'Abysses');
  await expect(card).toContainText(
    `Morgane n'a aucune disponibilité${NBSP}: coche ses créneaux sur sa fiche.`,
  );
  await expect(card.getByRole('button', { name: 'Programmer sur…' })).toHaveCount(0);
  await expect(card.getByRole('list', { name: 'Créneaux' })).toHaveCount(0);
  await expect(card).toHaveClass(/unschedulable/);
});

test("dans le filtre d'un créneau, un scénario programmé ailleurs porte une mention (PR-3, PR-6)", async ({
  page,
}) => {
  const { neons, slot1, tableId } = await prepare(page);
  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: neons.id,
    timeSlotId: slot1,
    tableId: tableId('Table 1'),
  });
  await page.goto('/gestion/');

  await reserve(page)
    .getByRole('button', { name: /^Créneau 2 / })
    .click();
  await expect(reserveCard(page, 'Néons')).toContainText(`Déjà programmé${NBSP}: créneau 1`);
  await expect(reserveCard(page, 'Ruines')).not.toContainText('Déjà programmé');
  await expect(
    reserveCard(page, 'Néons').getByRole('button', { name: 'Programmer sur…' }),
  ).toBeVisible();
});

test('programmer par « Programmer sur… » : la partie entre dans la frise (PR-3)', async ({
  page,
}) => {
  await prepare(page);
  await page.goto('/gestion/');

  await reserve(page)
    .getByRole('listitem')
    .filter({ hasText: 'Brumes' })
    .getByRole('button', { name: 'Programmer sur…' })
    .click();
  await placementDialog(page)
    .getByRole('button', { name: cell(1, 9, 'Table 2') })
    .click();

  await expect(placementDialog(page)).toHaveCount(0);
  const game = page.getByRole('article').filter({ hasText: 'Brumes' });
  await expect(game).toContainText('Kaïros');
  await expect(game).toContainText('3 à 5 places');
  await expect(game).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Partie « Brumes » programmée${NBSP}: créneau 1, Table 2.`,
  );
  await page.reload();
  await expect(page.getByRole('article').filter({ hasText: 'Brumes' })).toBeVisible();
});

test('le dialogue de placement éteint chaque case refusée, avec son motif (PR-5)', async ({
  page,
}) => {
  const { neons, brumes, slot1, tableId } = await prepare(page);
  await page.goto('/gestion/');
  const dialog = placementDialog(page);
  const open = async (title: string) => {
    await reserve(page)
      .getByRole('listitem')
      .filter({ hasText: title })
      .getByRole('button', { name: 'Programmer sur…' })
      .click();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeVisible();
  };
  const rowOf = (table: string) => dialog.getByRole('row', { name: new RegExp(`^${table}`) });

  // Kaïros n'est pas disponible sur le créneau 2.
  await open('Brumes');
  await expect(dialog.getByText('MJ indisponible')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Annuler' }).click();

  // « Brumes » occupe la table 1 au créneau 1.
  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: brumes.id,
    timeSlotId: slot1,
    tableId: tableId('Table 1'),
  });
  await page.reload();
  await open('Néons');
  await expect(rowOf('Table 1')).toContainText('Table prise');
  await expect(dialog.getByRole('button', { name: /^Choisir/ })).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Annuler' }).click();

  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: neons.id,
    timeSlotId: slot1,
    tableId: tableId('Table 2'),
  });
  await page.reload();
  await reserve(page)
    .getByRole('button', { name: /^Créneau 2 / })
    .click();
  await open('Ruines');
  await expect(rowOf('Table 1')).toContainText('MJ déjà occupé');
  await expect(rowOf('Table 2')).toContainText('MJ déjà occupé');
});

test('programmer au clavier seul', async ({ page }) => {
  await prepare(page);
  await page.goto('/gestion/');
  const program = reserve(page)
    .getByRole('listitem')
    .filter({ hasText: 'Brumes' })
    .getByRole('button', { name: 'Programmer sur…' });
  await program.focus();

  await page.keyboard.press('Enter');
  const first = placementDialog(page).getByRole('button', { name: cell(1, 9, 'Table 1') });
  await expect(first).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    placementDialog(page).getByRole('button', { name: cell(1, 9, 'Table 2') }),
  ).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(placementDialog(page)).toHaveCount(0);
  await expect(page.getByRole('article').filter({ hasText: 'Brumes' })).toBeFocused();
});

test('un créneau ou une table qui porte une partie ne se supprime pas : le dialogue dit pourquoi (PR-10)', async ({
  page,
}) => {
  const { neons, slot1, tableId } = await prepare(page);
  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: neons.id,
    timeSlotId: slot1,
    tableId: tableId('Table 1'),
  });
  await page.goto('/gestion/creneaux-et-tables');

  await page.getByRole('button', { name: 'Supprimer le créneau 1' }).click();
  let dialog = page.getByRole('alertdialog', { name: /^Supprimer le créneau 1/ });
  await dialog.getByRole('button', { name: 'Supprimer le créneau' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    `Le créneau 1 porte une partie${NBSP}: déprogramme-la d'abord.`,
  );
  await dialog.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: 'Supprimer la table Table 1' }).click();
  dialog = page.getByRole('alertdialog', { name: /^Supprimer la table/ });
  await dialog.getByRole('button', { name: 'Supprimer la table' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    `La table «${NBSP}Table 1${NBSP}» porte une partie${NBSP}: déprogramme-la d'abord.`,
  );
  await dialog.getByRole('button', { name: 'Fermer' }).click();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Supprimer le créneau 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Supprimer la table Table 1' })).toBeVisible();
});
