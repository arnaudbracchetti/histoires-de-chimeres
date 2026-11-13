import type { Browser, Page } from '@playwright/test';
import {
  apiUrl,
  participantEndpoints,
  scenarioEndpoints,
  timeSlotEndpoints,
  type AddedParticipantDto,
  type ScenarioBody,
} from '@chimeres/contract';
import { expect, ORGANIZER_NICKNAME, test } from '../../fixtures.js';
import { addGameMaster, expectOk, post } from './api.js';

const PASSWORD = 'la chimère dort sous le pont';

/** Les entrées du rail réservées aux Organisateurs. */
const ORGANIZER_ENTRIES = [
  'Calendrier',
  'MJ',
  'Créneaux et tables',
  'Pilotage du jour J',
  'Participants',
  'Informations de connexion',
];

/**
 * Un MJ créé par l'assistant « Créer un pseudo », qui entre par le vrai lien d'accès, dans un
 * navigateur sans session : sa page, et l'identifiant de son MJ.
 */
async function gameMasterByAccessLink(page: Page, browser: Browser, nickname: string) {
  const { gameMasterId, accessLink } = await post<AddedParticipantDto>(
    page,
    apiUrl(participantEndpoints.add),
    { nickname, roles: ['game-master'] },
  );
  const context = await browser.newContext();
  const gameMaster = await context.newPage();
  await gameMaster.goto(accessLink!.url);
  await gameMaster.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await gameMaster.getByLabel('Mot de passe, une seconde fois').fill(PASSWORD);
  await gameMaster.getByRole('button', { name: 'Choisir ce mot de passe' }).click();
  return { gameMaster, gameMasterId: gameMasterId! };
}

const scenarioOf = (title: string): ScenarioBody => ({
  title,
  system: 'Pendragon',
  presentation: 'Une quête **au long cours**.',
  contentWarnings: '',
  seats: { min: 3, max: 5 },
  duration: 1,
});

test("un MJ entre par son lien d'accès, propose un scénario, déclare une disponibilité, et lit le scénario d'un autre MJ", async ({
  page,
  browser,
}) => {
  await expectOk(
    page.request.post(apiUrl(timeSlotEndpoints.add), { data: { start: '10:00', end: '12:00' } }),
  );
  const margot = await addGameMaster(page.request, 'Margot');
  await post(
    page,
    apiUrl(scenarioEndpoints.propose, { gameMasterId: margot }),
    scenarioOf('Excalibur'),
  );

  const { gameMaster: lune } = await gameMasterByAccessLink(page, browser, 'Lune');

  // Ma fiche, l'accueil du MJ : son pseudo pour titre, sur l'onglet « Mes scénarios ».
  await expect(lune).toHaveURL(/\/gestion\/ma-fiche$/);
  await expect(lune.getByRole('heading', { level: 1, name: 'Lune' })).toBeVisible();
  await expect(lune.getByRole('navigation', { name: "Fil d'Ariane" })).toHaveCount(0);
  await expect(lune.getByRole('button', { name: 'Modifier le pseudo' })).toHaveCount(0);
  await expect(lune.getByRole('tab', { name: 'Mes scénarios' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await lune.getByRole('link', { name: 'Proposer un scénario' }).click();
  await lune.getByRole('textbox', { name: 'Titre', exact: true }).fill("La Tour d'ébène");
  await lune.getByRole('textbox', { name: 'Jeu', exact: true }).fill("L'Appel de Cthulhu");
  await lune
    .getByRole('textbox', { name: 'Présentation', exact: true })
    .fill('Une tour, une nuit.');
  await lune.getByRole('spinbutton', { name: 'Places minimum' }).fill('3');
  await lune.getByRole('spinbutton', { name: 'Places maximum' }).fill('5');
  await lune.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lune.getByRole('heading', { level: 1, name: "La Tour d'ébène" })).toBeVisible();
  await lune.locator('.game-master').getByRole('link', { name: 'Lune' }).click();

  await expect(lune.getByRole('link', { name: "La Tour d'ébène" })).toBeVisible();
  await lune.getByRole('tab', { name: /Mes disponibilités/ }).click();
  await lune.locator('label.block').first().click();
  await expect(lune.locator('label.pending')).toHaveCount(0);
  await expect(lune.getByRole('tab', { name: /Mes disponibilités/ })).toContainText('1 / 1');
  await lune.reload();
  await lune.getByRole('tab', { name: /Mes disponibilités/ }).click();
  await expect(lune.getByRole('checkbox')).toBeChecked();

  // Le scénario d'un autre MJ, en lecture seule, sans lien vers la fiche de son MJ.
  await lune.locator('app-rail').getByRole('link', { name: 'Scénarios de la convention' }).click();
  await expect(
    lune.getByRole('heading', { level: 1, name: 'Scénarios de la convention' }),
  ).toBeVisible();
  const table = lune.getByRole('table', { name: 'Scénarios de la convention' });
  await expect(
    table.getByRole('row', { name: /Excalibur/ }).getByRole('link', { name: 'Margot' }),
  ).toHaveCount(0);
  await lune.getByRole('button', { name: 'Les miens' }).click();
  await expect(table.locator('tbody th a')).toHaveText(["La Tour d'ébène"]);
  await lune.getByRole('button', { name: 'Tous' }).click();
  await table.getByRole('link', { name: 'Excalibur' }).click();

  await expect(lune.getByRole('heading', { level: 1, name: 'Excalibur' })).toBeVisible();
  await expect(lune.getByText('Proposé par Margot')).toBeVisible();
  await expect(lune.getByText('au long cours')).toBeVisible();
  await expect(lune.getByRole('link', { name: 'Margot' })).toHaveCount(0);
  await expect(lune.getByRole('textbox')).toHaveCount(0);
  await expect(lune.getByRole('button', { name: 'Autres actions sur le scénario' })).toHaveCount(0);
  await expect(lune.getByRole('button', { name: /image/i })).toHaveCount(0);
  await lune.context().close();
});

test("un MJ seul ne voit aucune entrée d'Organisateur ; un MJ Organisateur voit « Mon espace MJ » en tête du rail", async ({
  page,
  browser,
}) => {
  const { gameMaster: lune } = await gameMasterByAccessLink(page, browser, 'Lune');
  const rail = lune.locator('app-rail');
  await expect(rail.getByRole('link', { name: 'Ma fiche' })).toBeVisible();
  await expect(rail.getByRole('navigation').getByRole('link')).toHaveText([
    'Ma fiche',
    'Scénarios de la convention',
  ]);
  for (const entry of ORGANIZER_ENTRIES) {
    await expect(rail.getByRole('link', { name: entry, exact: true })).toHaveCount(0);
  }
  await lune.context().close();

  // L'Organisateur des tests reçoit aussi le rôle MJ.
  const participants = await (
    await expectOk(page.request.get(apiUrl(participantEndpoints.list)))
  ).json();
  const organizer = (participants as { id: string; nickname: string }[]).find(
    ({ nickname }) => nickname === ORGANIZER_NICKNAME,
  )!;
  await expectOk(
    page.request.put(
      apiUrl(participantEndpoints.appointGameMaster, { participantId: organizer.id }),
    ),
  );
  await page.goto('/gestion/');
  const fullRail = page.locator('app-rail');
  await expect(fullRail.getByRole('heading', { level: 2 })).toHaveText([
    'Mon espace MJ',
    'Préparation',
    'Jour J',
  ]);
  await expect(fullRail.getByRole('navigation').getByRole('link').first()).toHaveText('Ma fiche');
  await fullRail.getByRole('link', { name: 'Ma fiche' }).click();
  await expect(page.getByRole('heading', { level: 1, name: ORGANIZER_NICKNAME })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Mes scénarios' })).toBeVisible();
});

test("les pages d'Organisateur ne s'ouvrent pas par URL pour un MJ", async ({ page, browser }) => {
  const margot = await addGameMaster(page.request, 'Margot');
  const { gameMaster: lune, gameMasterId } = await gameMasterByAccessLink(page, browser, 'Lune');
  await expect(lune).toHaveURL(/\/gestion\/ma-fiche$/);

  // L'API refuse : 403.
  const response = await lune.request.get(apiUrl(participantEndpoints.list));
  expect(response.status()).toBe(403);

  // Le back office l'explique, sans changer l'adresse.
  for (const path of [
    'participants',
    'creneaux-et-tables',
    'pilotage',
    'informations-de-connexion',
    'mj',
  ]) {
    await lune.goto(`/gestion/${path}`);
    await expect(lune.getByRole('heading', { level: 1, name: 'Accès refusé' })).toBeVisible();
    await expect(lune.getByText('réservée aux Organisateurs')).toBeVisible();
    await expect(lune).toHaveURL(new RegExp(`/gestion/${path}$`));
  }

  // La fiche d'un autre MJ : le refus de l'API, à la place de la fiche.
  await lune.goto(`/gestion/mj/${margot}`);
  await expect(lune.getByText('Ton compte ne donne pas accès à cette page.')).toBeVisible();
  await expect(lune.getByRole('button', { name: 'Réessayer' })).toHaveCount(0);

  // Sa propre fiche par son URL, l'accueil : Ma fiche.
  await lune.goto(`/gestion/mj/${gameMasterId}`);
  await expect(lune).toHaveURL(/\/gestion\/ma-fiche$/);
  await lune.goto('/gestion/');
  await expect(lune).toHaveURL(/\/gestion\/ma-fiche$/);
  await lune.context().close();
});
