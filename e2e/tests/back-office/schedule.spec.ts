import type { Locator, Page } from '@playwright/test';
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

/**
 * « Choisir Créneau 2 · 14 h 00 – 16 h 30, Table 1 » : le nom accessible d'un « Choisir », ou d'un
 * « Échanger » avec `action`.
 */
const cell = (rank: number, start: number, table: string, action = 'Choisir') =>
  `${action} Créneau ${rank} · ${start}${NBSP}h${NBSP}00${THIN}–${THIN}${start + 2}${NBSP}h${NBSP}30, ${table}`;

async function post(page: Page, url: string, data: object) {
  const response = await page.request.post(url, { data });
  expect(response.ok()).toBe(true);
  return response.json();
}

/** Par l'API : un scénario du MJ, d'un ou deux créneaux. */
function proposeScenario(
  page: Page,
  gameMasterId: string,
  title: string,
  duration: 1 | 2 = 1,
): Promise<ScenarioDto> {
  return post(page, apiUrl(scenarioEndpoints.propose, { gameMasterId }), {
    title,
    system: 'Cthulhu',
    presentation: 'Une enquête.',
    contentWarnings: '',
    seats: { min: 3, max: 5 },
    duration,
  });
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
  const propose = (gameMasterId: string, title: string) =>
    proposeScenario(page, gameMasterId, title);
  const neons = await propose(elodie, 'Néons');
  const ruines = await propose(elodie, 'Ruines');
  const brumes = await propose(kairos, 'Brumes');
  const tableId = (name: string) => convention!.tables.find((t) => t.name === name)!.id;
  return { slot1, slot2, elodie, neons, ruines, brumes, tableId };
}

/** Par l'API, en plus de `prepare` : « Abysses », scénario double d'Élodie. */
async function prepareDouble(page: Page) {
  const prepared = await prepare(page);
  const abysses = await proposeScenario(page, prepared.elodie, 'Abysses', 2);
  return { ...prepared, abysses };
}

const reserve = (page: Page) => page.getByRole('region', { name: 'Réserve' });
const placementDialog = (page: Page) => page.getByRole('dialog');
const timeline = (page: Page) =>
  page.getByRole('table', { name: 'Programme, par table et par créneau' });
/** Le bouton d'une carte de partie, qui ouvre sa fiche. */
const gameButton = (page: Page, title: string) =>
  timeline(page).getByRole('button', { name: title, exact: true });
const sheet = (page: Page) => page.getByRole('complementary');

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
  const headers = frise.getByRole('columnheader', { name: /^Créneau/ });
  // `evaluateAll` n'attend pas : la frise doit d'abord être rendue.
  await expect(headers).toHaveCount(2);
  const [short, long] = await headers.evaluateAll((headers) =>
    headers.map((header) => header.getBoundingClientRect().width),
  );
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
  await expect(gameButton(page, 'Brumes')).toBeFocused();
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
  await expect(gameButton(page, 'Brumes')).toBeFocused();
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

  const tables = page.getByRole('region', { name: 'Tables' });
  await tables.getByRole('button', { name: 'Modifier la table Table 1', exact: true }).click();
  await tables.getByRole('textbox').fill('Dragon');
  await tables.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(tables.getByRole('article', { name: 'Dragon', exact: true })).toBeVisible();
  await page.goto('/gestion/');
  await expect(timelineRow(page, 'Dragon')).toContainText('Néons');
});

test('les heures d’un créneau qui porte une partie sont refusées (PR-11)', async ({ page }) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/creneaux-et-tables');
  const section = page.getByRole('region', { name: 'Créneaux' });

  await section.getByRole('button', { name: 'Modifier le créneau 1', exact: true }).click();
  await section.getByLabel('Début').fill('08:00');
  await section.getByLabel('Fin').fill('10:30');
  await section.getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Heures figées' })).toContainText(
    `Le créneau 1 porte une partie${NBSP}: ses heures ne changent plus.`,
  );
});

test('la durée d’un scénario programmé est refusée sous son champ (PR-14)', async ({ page }) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto(`/gestion/scenarios/${neons.id}`);

  await page.getByRole('radio', { name: '2 créneaux' }).check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('group', { name: 'Durée' })).toHaveAccessibleDescription(
    `Ce scénario est programmé${NBSP}: sa durée ne change plus. Déprogramme d'abord ses parties.`,
  );
  await page.reload();
  await expect(page.getByRole('radio', { name: '1 créneau' })).toBeChecked();
});

test('un scénario programmé ne se supprime pas : le dialogue dit pourquoi (PR-14)', async ({
  page,
}) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto(`/gestion/scenarios/${neons.id}`);

  await page.getByRole('button', { name: 'Autres actions sur le scénario' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer le scénario' }).click();
  const dialog = page.getByRole('alertdialog', { name: /^Supprimer le scénario/ });
  await dialog.getByRole('button', { name: 'Supprimer le scénario' }).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    `Ce scénario est programmé${NBSP}: déprogramme d'abord ses parties.`,
  );
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Néons' })).toBeVisible();
});

test('une disponibilité où le MJ mène une partie est verrouillée, puis libre après la déprogrammation (PR-15)', async ({
  page,
}) => {
  const { neons, slot1, elodie, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto(`/gestion/mj/${elodie}`);
  const first = page.getByRole('checkbox', {
    name: `Créneau 1 · 9${NBSP}h${NBSP}00${THIN}–${THIN}11${NBSP}h${NBSP}30`,
  });

  await expect(first).toBeChecked();
  await expect(first).toBeDisabled();
  await expect(first).toHaveAccessibleDescription(`Mène «${NBSP}Néons${NBSP}» Table 1`);

  await page.goto('/gestion/');
  await gameButton(page, 'Néons').click();
  await sheet(page).getByRole('button', { name: 'Déprogrammer' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.goto(`/gestion/mj/${elodie}`);

  await expect(first).toBeEnabled();
  await page.locator('label.block').filter({ has: first }).click();
  await expect(first).not.toBeChecked();
  await expect(page.locator('label.pending')).toHaveCount(0);
  await page.reload();
  await expect(first).not.toBeChecked();
});

/** Programme le scénario par l'API, sur le créneau et la table donnés. */
async function scheduleByApi(
  page: Page,
  scenarioId: string,
  timeSlotId: string,
  tableId: string,
): Promise<void> {
  await post(page, apiUrl(scheduleEndpoints.schedule), { scenarioId, timeSlotId, tableId });
}

/** La ligne d'une table dans la frise. */
const timelineRow = (page: Page, table: string) =>
  timeline(page).getByRole('row', { name: new RegExp(`^${table}`) });

test('un clic sur une partie ouvre sa fiche, à droite de la frise qui se rétrécit', async ({
  page,
}) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');
  const width = () => timeline(page).evaluate((element) => element.getBoundingClientRect().width);
  const before = await width();

  await page.getByRole('article').filter({ hasText: 'Néons' }).click();

  await expect(sheet(page)).toHaveAccessibleName('Néons');
  await expect(sheet(page)).toContainText('Cthulhu');
  await expect(sheet(page)).toContainText('Élodie');
  await expect(sheet(page)).toContainText(
    `Créneau 1 · 9${NBSP}h${NBSP}00${THIN}–${THIN}11${NBSP}h${NBSP}30`,
  );
  await expect(sheet(page)).toContainText('Table 1');
  await expect(sheet(page)).toContainText('3 à 5 places');
  expect(await width()).toBeLessThan(before);
  const [timelineBox, sheetBox] = [
    await timeline(page).boundingBox(),
    await sheet(page).boundingBox(),
  ];
  expect(sheetBox!.x).toBeGreaterThan(timelineBox!.x + timelineBox!.width - 1);
  await expect(gameButton(page, 'Néons')).toHaveAttribute('aria-expanded', 'true');
});

test('« Déplacer vers… » vers un autre créneau, puis vers une autre table (PR-17)', async ({
  page,
}) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');
  await gameButton(page, 'Néons').click();

  await sheet(page).getByRole('button', { name: 'Déplacer vers…' }).click();
  await expect(placementDialog(page).getByRole('heading')).toHaveText('Déplacer « Néons » vers…');
  await placementDialog(page)
    .getByRole('button', { name: cell(2, 14, 'Table 1') })
    .click();

  await expect(placementDialog(page)).toHaveCount(0);
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Partie déplacée${NBSP}: créneau 2, table Table 1.`,
  );
  await expect(sheet(page)).toContainText(`Créneau 2 · 14${NBSP}h${NBSP}00`);

  await sheet(page).getByRole('button', { name: 'Déplacer vers…' }).click();
  await placementDialog(page)
    .getByRole('button', { name: cell(2, 14, 'Table 2') })
    .click();

  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Partie déplacée${NBSP}: créneau 2, table Table 2.`,
  );
  await expect(timelineRow(page, 'Table 2')).toContainText('Néons');
  await page.reload();
  await expect(timelineRow(page, 'Table 2')).toContainText('Néons');
  await expect(timelineRow(page, 'Table 1')).not.toContainText('Néons');
});

test('le dialogue « Déplacer vers… » éteint les cases refusées, avec leur motif (PR-5)', async ({
  page,
}) => {
  const { neons, brumes, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await scheduleByApi(page, brumes.id, slot1, tableId('Table 2'));
  await page.goto('/gestion/');

  await gameButton(page, 'Brumes').click();
  await sheet(page).getByRole('button', { name: 'Déplacer vers…' }).click();

  const dialog = placementDialog(page);
  const rowOf = (table: string) => dialog.getByRole('row', { name: new RegExp(`^${table}`) });
  await expect(rowOf('Table 1').getByRole('button', { name: 'Échanger' })).toBeVisible();
  await expect(rowOf('Table 2')).toContainText('Sa place');
  await expect(dialog.getByText('MJ indisponible')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: /^Choisir/ })).toHaveCount(0);
});

test('échanger deux parties par « Déplacer vers… » (PR-17)', async ({ page }) => {
  const { neons, ruines, slot1, slot2, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot2, tableId('Table 1'));
  await scheduleByApi(page, ruines.id, slot1, tableId('Table 2'));
  await page.goto('/gestion/');

  await gameButton(page, 'Néons').click();
  await sheet(page).getByRole('button', { name: 'Déplacer vers…' }).click();
  await placementDialog(page)
    .getByRole('button', { name: cell(1, 9, 'Table 2', 'Échanger') })
    .click();

  await expect(placementDialog(page)).toHaveCount(0);
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Parties «${NBSP}Néons${NBSP}» et «${NBSP}Ruines${NBSP}» échangées.`,
  );
  await expect(sheet(page)).toContainText(`Créneau 1 · 9${NBSP}h${NBSP}00`);
  await page.reload();
  await expect(timelineRow(page, 'Table 2')).toContainText('Néons');
  await expect(timelineRow(page, 'Table 1')).toContainText('Ruines');
});

test('échanger une partie double avec une partie simple, puis le refus avec son motif (PR-5, PR-17)', async ({
  page,
}) => {
  const { abysses, brumes, slot1, slot2, tableId } = await prepareDouble(page);
  await scheduleByApi(page, abysses.id, slot1, tableId('Table 1'));
  await scheduleByApi(page, brumes.id, slot1, tableId('Table 2'));
  await page.goto('/gestion/');

  await gameButton(page, 'Abysses').click();
  await sheet(page).getByRole('button', { name: 'Déplacer vers…' }).click();
  await placementDialog(page)
    .getByRole('button', { name: cell(1, 9, 'Table 2', 'Échanger') })
    .click();

  await expect(placementDialog(page)).toHaveCount(0);
  await expect(timelineRow(page, 'Table 2')).toContainText('Abysses');
  await expect(timelineRow(page, 'Table 1')).toContainText('Brumes');

  // Une partie de Moïra prend la table 1 au créneau 2 : Abysses n'y revient plus.
  const [moira] = (
    (await post(page, apiUrl(gameMasterEndpoints.add), { nickname: 'Moïra' })) as GameMasterDto[]
  ).filter(({ nickname }) => nickname === 'Moïra');
  const declared = await page.request.put(
    apiUrl(availabilityEndpoints.declare, { gameMasterId: moira!.id, timeSlotId: slot2 }),
  );
  expect(declared.ok()).toBe(true);
  const marees = await proposeScenario(page, moira!.id, 'Marées');
  await scheduleByApi(page, marees.id, slot2, tableId('Table 1'));
  await page.reload();
  await gameButton(page, 'Abysses').click();
  await sheet(page).getByRole('button', { name: 'Déplacer vers…' }).click();

  const refused = placementDialog(page)
    .getByRole('row', { name: /^Table 1/ })
    .getByRole('cell')
    .first();
  await expect(refused).toContainText('Table prise');
  await expect(refused.locator('.off')).toHaveAttribute(
    'title',
    `La table «${NBSP}Table 1${NBSP}» accueille déjà une partie sur le créneau 2${NBSP}: choisis une autre table.`,
  );
  await expect(placementDialog(page).getByRole('button', { name: /^Échanger/ })).toHaveCount(0);
});

test('échanger au clavier seul (PR-17)', async ({ page }) => {
  const { neons, ruines, slot1, slot2, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot2, tableId('Table 1'));
  await scheduleByApi(page, ruines.id, slot1, tableId('Table 2'));
  await page.goto('/gestion/');
  await gameButton(page, 'Néons').focus();

  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Néons' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(sheet(page).getByRole('button', { name: 'Déplacer vers…' })).toBeFocused();
  await page.keyboard.press('Enter');
  // Élodie mène Ruines au créneau 1 : la seule case possible est l'échange avec elle.
  await expect(
    placementDialog(page).getByRole('button', { name: cell(1, 9, 'Table 2', 'Échanger') }),
  ).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(placementDialog(page)).toHaveCount(0);
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await expect(timelineRow(page, 'Table 2')).toContainText('Néons');
  await expect(timelineRow(page, 'Table 1')).toContainText('Ruines');
});

test('« Déprogrammer » dans la fiche : le scénario revient dans la réserve (PR-17)', async ({
  page,
}) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');
  await expect(reserve(page).getByRole('heading', { level: 3 })).toHaveText(['Brumes']);

  await gameButton(page, 'Néons').click();
  await sheet(page).getByRole('button', { name: 'Déprogrammer' }).click();

  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole('article').filter({ hasText: 'Néons' })).toHaveCount(0);
  await expect(reserve(page).getByRole('heading', { level: 3 })).toHaveText([
    'Brumes',
    'Néons',
    'Ruines',
  ]);
  await expect(page.locator('[aria-live="polite"]')).toHaveText(`Partie « Néons » déprogrammée.`);
  await expect(reserve(page).getByRole('heading', { level: 2 })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('Échap ou ✕ ferme la fiche, et le focus revient à la partie', async ({ page }) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');

  await gameButton(page, 'Néons').click();
  await expect(sheet(page).getByRole('heading', { name: 'Néons' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await expect(gameButton(page, 'Néons')).toHaveAttribute('aria-expanded', 'false');

  await gameButton(page, 'Néons').click();
  await sheet(page).getByRole('button', { name: 'Fermer la fiche' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(gameButton(page, 'Néons')).toBeFocused();
});

test('déplacer puis déprogrammer au clavier seul', async ({ page }) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');
  await gameButton(page, 'Néons').focus();

  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Néons' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(sheet(page).getByRole('button', { name: 'Fermer la fiche' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(sheet(page).getByRole('button', { name: 'Déplacer vers…' })).toBeFocused();
  await page.keyboard.press('Enter');
  // La case de la partie est « Sa place » : la première case libre est au créneau 2, table 1.
  await expect(
    placementDialog(page).getByRole('button', { name: cell(2, 14, 'Table 1') }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(placementDialog(page)).toHaveCount(0);
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await expect(sheet(page)).toContainText(`Créneau 2 · 14${NBSP}h${NBSP}00`);

  await page.keyboard.press('Enter');
  await expect(sheet(page).getByRole('heading', { name: 'Néons' })).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await expect(sheet(page).getByRole('button', { name: 'Déprogrammer' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article').filter({ hasText: 'Néons' })).toHaveCount(0);
  await expect(reserve(page).getByRole('heading', { level: 2 })).toBeFocused();
});

test('programmer une partie double : une seule carte, sur ses deux créneaux et la pause (PR-5, PR-8)', async ({
  page,
}) => {
  await prepareDouble(page);
  await page.goto('/gestion/');

  await reserveCard(page, 'Abysses').getByRole('button', { name: 'Programmer sur…' }).click();
  await placementDialog(page)
    .getByRole('button', { name: cell(1, 9, 'Table 1') })
    .click();

  await expect(placementDialog(page)).toHaveCount(0);
  const game = page.getByRole('article').filter({ hasText: 'Abysses' });
  await expect(game).toHaveCount(1);
  await expect(game).toContainText('double');
  await expect(gameButton(page, 'Abysses')).toBeFocused();
  const box = (await game.boundingBox())!;
  const headers = timeline(page).getByRole('columnheader');
  const first = (await headers.filter({ hasText: 'Créneau 1' }).boundingBox())!;
  const pause = (await headers.filter({ hasText: 'Pause' }).boundingBox())!;
  const second = (await headers.filter({ hasText: 'Créneau 2' }).boundingBox())!;
  expect(box.x).toBeLessThanOrEqual(first.x + 1);
  expect(box.x + box.width).toBeGreaterThan(pause.x + pause.width);
  expect(box.x + box.width).toBeGreaterThanOrEqual(second.x + second.width - 1);
  await gameButton(page, 'Abysses').click();
  await expect(sheet(page)).toContainText('Créneaux');
  await expect(sheet(page)).toContainText(`Créneau 2 · 14${NBSP}h${NBSP}00`);
});

test('le dialogue de placement d’un scénario double dit « Pas de créneau suivant » (PR-8)', async ({
  page,
}) => {
  await prepareDouble(page);
  await page.goto('/gestion/');

  await reserveCard(page, 'Abysses').getByRole('button', { name: 'Programmer sur…' }).click();

  const dialog = placementDialog(page);
  await expect(dialog.getByText('Pas de créneau suivant')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: /^Choisir Créneau 1/ })).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: /^Choisir Créneau 2/ })).toHaveCount(0);
});

test('un scénario double n’est pas dans la réserve du dernier créneau (PR-6)', async ({ page }) => {
  await prepareDouble(page);
  await page.goto('/gestion/');

  await expect(reserve(page).getByRole('heading', { level: 3 })).toHaveText([
    'Abysses',
    'Brumes',
    'Néons',
    'Ruines',
  ]);
  await expect(reserveCard(page, 'Abysses')).toContainText('double');
  await expect(reserveCard(page, 'Brumes')).not.toContainText('double');
  await reserve(page)
    .getByRole('button', { name: /^Créneau 2 / })
    .click();
  await expect(reserve(page).getByRole('heading', { level: 3 })).toHaveText(['Néons', 'Ruines']);
});

test('un créneau ajouté entre les deux créneaux d’une partie double est refusé (PR-11)', async ({
  page,
}) => {
  const { abysses, slot1, tableId } = await prepareDouble(page);
  await scheduleByApi(page, abysses.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/creneaux-et-tables');
  const section = page.getByRole('region', { name: 'Créneaux' });
  const start = section.locator('article.editing').getByLabel('Début');

  await section.getByRole('button', { name: 'Ajouter un créneau', exact: true }).click();
  // 11 h 30 – 14 h 00 : bout à bout avec les deux créneaux, dans la pause qui les sépare.
  await start.fill('11:30');
  await page.keyboard.press('Enter');

  await expect(start).toHaveAccessibleDescription(
    `Ce créneau tomberait entre les créneaux 1 et 2, qu'occupe une partie double${NBSP}: choisis d'autres heures.`,
  );
  await page.reload();
  await expect(section.getByRole('heading', { name: /^Créneau \d/ })).toHaveCount(2);
});

/** La case d'un créneau et d'une table dans la frise : la cible d'un glisser-déposer. */
const slotCell = (page: Page, timeSlotId: string, tableId: string) =>
  timeline(page).locator(`[data-drop-time-slot="${timeSlotId}"][data-drop-table="${tableId}"]`);

/** Le curseur que montre la frise sous le pointeur : `poll` le relit jusqu'à la valeur attendue. */
const cursor = (page: Page) =>
  expect.poll(() => timeline(page).evaluate((element) => getComputedStyle(element).cursor));

/** La barre d'aide, au-dessus de la frise. */
const helpBar = (page: Page) => page.locator('p.help');

/** Le titre d'un scénario dans le bac de réserve : on le saisit par là. */
const reserveTitle = (page: Page, title: string) =>
  reserveCard(page, title).getByRole('heading', { level: 3 });

/**
 * Saisit `from` à la souris et l'amène sur `to`, par petits pas : le CDK ne démarre le geste
 * qu'après quelques pixels. Le bouton reste enfoncé : `page.mouse.up()` dépose.
 */
async function dragOver(page: Page, from: Locator, to: Locator) {
  const source = (await from.boundingBox())!;
  const x = source.x + source.width / 2;
  const y = source.y + source.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 5 });
  const target = (await to.boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
}

async function dragTo(page: Page, from: Locator, to: Locator) {
  await dragOver(page, from, to);
  await page.mouse.up();
}

test('programmer par glisser-déposer : une partie simple, puis une partie double (PR-3, PR-8)', async ({
  page,
}) => {
  const { slot1, slot2, tableId } = await prepareDouble(page);
  await page.goto('/gestion/');

  // Saisi par son titre, le scénario se tient par sa vignette : elle est sous le pointeur.
  await dragOver(page, reserveTitle(page, 'Brumes'), slotCell(page, slot1, tableId('Table 1')));
  await expect(slotCell(page, slot1, tableId('Table 1'))).toHaveClass(/valid/);
  const pointer = (await slotCell(page, slot1, tableId('Table 1')).boundingBox())!;
  const thumbnail = (await page
    .locator('.cdk-drag-preview app-scenario-illustration')
    .boundingBox())!;
  expect(thumbnail.x + thumbnail.width / 2).toBeCloseTo(pointer.x + pointer.width / 2, -1);
  expect(thumbnail.y + thumbnail.height / 2).toBeCloseTo(pointer.y + pointer.height / 2, -1);
  await cursor(page).toBe('grabbing');
  await page.mouse.up();
  await cursor(page).not.toBe('grabbing');

  await expect(slotCell(page, slot1, tableId('Table 1'))).toContainText('Brumes');
  await expect(gameButton(page, 'Brumes')).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Partie « Brumes » programmée${NBSP}: créneau 1, Table 1.`,
  );

  await dragTo(page, reserveTitle(page, 'Abysses'), slotCell(page, slot1, tableId('Table 2')));

  // Ses deux créneaux, et la pause entre eux.
  const abysses = slotCell(page, slot1, tableId('Table 2'));
  await expect(abysses).toContainText('Abysses');
  await expect(abysses).toHaveAttribute('aria-colspan', '3');
  await expect(slotCell(page, slot2, tableId('Table 2'))).toHaveCount(0);
  await page.reload();
  await expect(slotCell(page, slot1, tableId('Table 2'))).toContainText('Abysses');
});

test('pendant un glisser, chaque cible refusée reste éteinte avec son motif, et la barre d’aide donne sa phrase (PR-5)', async ({
  page,
}) => {
  const { neons, slot1, slot2, tableId } = await prepareDouble(page);
  const showAll = async () => {
    await page.goto('/gestion/');
    await reserve(page)
      .getByRole('button', { name: /^Tous les scénarios / })
      .click();
  };
  const expectRefused = async (
    title: string,
    [timeSlotId, table]: [string, string],
    motif: string,
    phrase: string,
  ) => {
    const target = slotCell(page, timeSlotId, tableId(table));
    await dragOver(page, reserveTitle(page, title), target);
    await expect(target).toContainText(motif);
    await expect(target).not.toHaveClass(/valid/);
    await cursor(page).toBe('not-allowed');
    // Une partie survolée ne s'éclaire pas : seul le halo des cibles valides parle.
    const game = target.getByRole('article');
    if (await game.count()) await expect(game).toHaveCSS('box-shadow', 'none');
    await expect(helpBar(page)).toHaveText(phrase);
    await page.mouse.up();
    await expect(helpBar(page)).toHaveText('');
    await cursor(page).not.toBe('not-allowed');
    // Le scénario revient au bac avant le geste suivant.
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
  };

  await showAll();
  await expectRefused(
    'Brumes',
    [slot2, 'Table 1'],
    'MJ indisponible',
    `Kaïros n'est pas disponible sur le créneau 2${NBSP}: coche d'abord sa disponibilité sur sa fiche.`,
  );
  await expectRefused(
    'Abysses',
    [slot2, 'Table 2'],
    'Pas de créneau suivant',
    `Le créneau 2 est le dernier de la journée${NBSP}: une partie double commence au plus tard sur le créneau 1.`,
  );

  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await showAll();
  await expectRefused(
    'Ruines',
    [slot1, 'Table 2'],
    'MJ déjà occupé',
    `Élodie mène déjà une partie sur le créneau 1${NBSP}: choisis un autre créneau.`,
  );
  await expectRefused(
    'Brumes',
    [slot1, 'Table 1'],
    'Table prise',
    `La table « Table 1 » accueille déjà une partie sur le créneau 1${NBSP}: choisis une autre table.`,
  );
  // Rien n'a été écrit : seule « Néons » est programmée.
  await page.reload();
  await expect(timeline(page).getByRole('article')).toHaveText([/Néons/]);
});

test('déplacer une partie par glisser-déposer vers un autre créneau, puis vers une autre table (PR-17)', async ({
  page,
}) => {
  const { neons, slot1, slot2, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');

  await dragTo(page, gameButton(page, 'Néons'), slotCell(page, slot2, tableId('Table 1')));

  await expect(slotCell(page, slot2, tableId('Table 1'))).toContainText('Néons');
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Partie déplacée${NBSP}: créneau 2, table Table 1.`,
  );

  await dragTo(page, gameButton(page, 'Néons'), slotCell(page, slot2, tableId('Table 2')));

  await expect(slotCell(page, slot2, tableId('Table 2'))).toContainText('Néons');
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await page.reload();
  await expect(slotCell(page, slot2, tableId('Table 2'))).toContainText('Néons');
  await expect(timeline(page).getByRole('article')).toHaveCount(1);
});

test('échanger deux parties simples par glisser-déposer (PR-17)', async ({ page }) => {
  const { neons, ruines, slot1, slot2, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot2, tableId('Table 1'));
  await scheduleByApi(page, ruines.id, slot1, tableId('Table 2'));
  await page.goto('/gestion/');

  await dragTo(page, gameButton(page, 'Néons'), gameButton(page, 'Ruines'));

  await expect(slotCell(page, slot1, tableId('Table 2'))).toContainText('Néons');
  await expect(slotCell(page, slot2, tableId('Table 1'))).toContainText('Ruines');
  await expect(gameButton(page, 'Néons')).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    'Parties « Néons » et « Ruines » échangées.',
  );
});

test('échanger une partie double et une partie simple par glisser-déposer (PR-17)', async ({
  page,
}) => {
  const { abysses, brumes, slot1, tableId } = await prepareDouble(page);
  await scheduleByApi(page, abysses.id, slot1, tableId('Table 1'));
  await scheduleByApi(page, brumes.id, slot1, tableId('Table 2'));
  await page.goto('/gestion/');

  await dragTo(page, gameButton(page, 'Abysses'), gameButton(page, 'Brumes'));

  await expect(slotCell(page, slot1, tableId('Table 2'))).toContainText('Abysses');
  await expect(slotCell(page, slot1, tableId('Table 2'))).toHaveAttribute('aria-colspan', '3');
  await expect(slotCell(page, slot1, tableId('Table 1'))).toContainText('Brumes');
  await page.reload();
  await expect(slotCell(page, slot1, tableId('Table 2'))).toContainText('Abysses');
});

test('déprogrammer une partie en la déposant sur le bac de réserve', async ({ page }) => {
  const { neons, slot1, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');
  const tray = page.locator('app-reserve-tray');

  await dragOver(page, gameButton(page, 'Néons'), tray);
  await expect(tray).toHaveClass(/valid/);
  await page.mouse.up();

  await expect(timeline(page).getByRole('article')).toHaveCount(0);
  await expect(reserve(page).getByRole('heading', { level: 2, name: 'Réserve' })).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toHaveText('Partie « Néons » déprogrammée.');
  await page.reload();
  await expect(timeline(page).getByRole('article')).toHaveCount(0);
});

test('un dépôt sur une case prise entre-temps est refusé : « Table prise », et l’écran se relit', async ({
  page,
  browser,
}) => {
  const { slot1, tableId } = await prepare(page);
  await page.goto('/gestion/');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const other = await context.newPage();
  await other.goto('/gestion/');
  const target = (on: Page) => slotCell(on, slot1, tableId('Table 1'));

  // Le second saisit « Néons » : à ce moment, la case est libre.
  await dragOver(other, reserveTitle(other, 'Néons'), target(other));
  await expect(target(other)).toHaveClass(/valid/);
  // Le premier la prend.
  await dragTo(page, reserveTitle(page, 'Brumes'), target(page));
  await expect(target(page)).toContainText('Brumes');
  await other.mouse.up();

  await expect(other.getByRole('alert').filter({ hasText: 'Table prise' })).toContainText(
    `La table « Table 1 » accueille déjà une partie sur le créneau 1${NBSP}: choisis une autre table.`,
  );
  await expect(target(other)).toContainText('Brumes');
  await expect(timeline(other).getByRole('article')).toHaveCount(1);
  await context.close();
});

test('un geste hors ligne : la partie revient à sa place, avec le message de coupure', async ({
  page,
}) => {
  const { neons, slot1, slot2, tableId } = await prepare(page);
  await scheduleByApi(page, neons.id, slot1, tableId('Table 1'));
  await page.goto('/gestion/');

  // La case s'éclaire, puis la connexion tombe avant le dépôt.
  await dragOver(page, gameButton(page, 'Néons'), slotCell(page, slot2, tableId('Table 1')));
  await expect(slotCell(page, slot2, tableId('Table 1'))).toHaveClass(/valid/);
  await page.context().setOffline(true);
  await page.mouse.up();

  await expect(page.getByRole('alert')).toContainText(
    `Pas de connexion${NBSP}: rien n'a été enregistré.`,
  );
  await expect(slotCell(page, slot1, tableId('Table 1'))).toContainText('Néons');
  await expect(slotCell(page, slot2, tableId('Table 1'))).not.toContainText('Néons');
  await page.context().setOffline(false);
});
