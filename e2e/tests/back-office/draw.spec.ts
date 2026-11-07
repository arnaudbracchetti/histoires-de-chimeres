import { devices, type Page } from '@playwright/test';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  gameMasterEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type ScenarioDto,
  type TimeSlotDto,
  type UpdateConventionBody,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';
import { aNickname, identify, identifyAsGameMaster } from '../front-office/identification.js';
import { gameCard, scheduleTab, timeSlotChip } from '../front-office/schedule.js';

/*
 * Le parcours du tirage tient en entier dans le projet `bureau`, qui pilote aussi un téléphone
 * (contexte Pixel 7). Dans la base du projet `mobile`, jamais remise à zéro et partagée par ses
 * tests en parallèle, un tirage lancé fermerait les inscriptions de leur créneau 1. Ici, la base
 * est remise à zéro avant le test (fixtures.ts), et le pseudo du téléphone lui reste propre.
 */

async function post<T>(page: Page, url: string, data: object): Promise<T> {
  const response = await page.request.post(url, { data });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as T;
}

/**
 * Par l'API : un créneau, la table « Griffon », et « Les Brumes » de Kaïros, d'une place au moins,
 * programmée à cette table. Une seule partie : une partie sans joueur empêcherait la publication.
 */
async function prepare(page: Page) {
  const { timeSlots } = await post<ConventionDto>(page, apiUrl(timeSlotEndpoints.add), {
    start: '09:00',
    end: '11:30',
  });
  const { tables } = await post<ConventionDto>(page, apiUrl(tableEndpoints.add), {
    name: 'Griffon',
  });
  const [{ id: gameMasterId }] = (await post<GameMasterDto[]>(
    page,
    apiUrl(gameMasterEndpoints.add),
    { nickname: 'Kaïros' },
  )) as [GameMasterDto];
  const [{ id: timeSlotId }] = timeSlots as [TimeSlotDto];
  const declared = await page.request.put(
    apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId }),
  );
  expect(declared.ok(), await declared.text()).toBe(true);
  const brumes = await post<ScenarioDto>(
    page,
    apiUrl(scenarioEndpoints.propose, { gameMasterId }),
    {
      title: 'Les Brumes',
      system: "L'Appel de Cthulhu",
      presentation: 'Une enquête sous la brume.',
      contentWarnings: '',
      seats: { min: 1, max: 5 },
      duration: 1,
    },
  );
  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: brumes.id,
    timeSlotId,
    tableId: tables[0]!.id,
  });
  return { timeSlotId };
}

/** Par l'API : la table « Licorne », et « Les Néons » de Sven, d'une place au moins, programmée à cette table. */
async function prepareNeons(page: Page, timeSlotId: string) {
  const { tables } = await post<ConventionDto>(page, apiUrl(tableEndpoints.add), {
    name: 'Licorne',
  });
  const gameMasters = await post<GameMasterDto[]>(page, apiUrl(gameMasterEndpoints.add), {
    nickname: 'Sven',
  });
  const gameMasterId = gameMasters.find(({ nickname }) => nickname === 'Sven')!.id;
  const declared = await page.request.put(
    apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId }),
  );
  expect(declared.ok(), await declared.text()).toBe(true);
  const neons = await post<ScenarioDto>(page, apiUrl(scenarioEndpoints.propose, { gameMasterId }), {
    title: 'Les Néons',
    system: 'Cyberpunk',
    presentation: 'Une course sous les néons.',
    contentWarnings: '',
    seats: { min: 1, max: 5 },
    duration: 1,
  });
  await post(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: neons.id,
    timeSlotId,
    tableId: tables.find(({ name }) => name === 'Licorne')!.id,
  });
}

test('le MJ d’une partie annulée rejoint les non placés avec ses inscriptions de secours (TI-6, IN-4)', async ({
  page,
  browser,
  baseURL,
}) => {
  const { timeSlotId } = await prepare(page);
  await prepareNeons(page, timeSlotId);
  const phoneContext = await browser.newContext({ ...devices['Pixel 7'], baseURL });
  try {
    const phone = await phoneContext.newPage();
    await identifyAsGameMaster(phone, 'Sven');
    await scheduleTab(phone).click();
    await timeSlotChip(phone, 1).click();
    await gameCard(phone, 'Les Brumes').click();
    await phone.getByRole('button', { name: "S'inscrire en secours" }).click();
    await expect(phone.getByText('Inscrit en secours')).toBeVisible();
  } finally {
    await phoneContext.close();
  }

  await page.goto('/gestion/');
  await page.getByRole('link', { name: 'Pilotage du jour J' }).click();
  await page.getByRole('button', { name: 'Lancer le tirage' }).click();
  await page
    .getByRole('alertdialog', { name: /^Lancer le tirage du créneau 1/ })
    .getByRole('button', { name: 'Lancer le tirage' })
    .click();
  const plan = page.getByRole('list', { name: 'Plan de salle' });
  await plan
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Les Néons' }) })
    .getByRole('button', { name: 'Annuler la partie' })
    .click();
  await page
    .getByRole('alertdialog', { name: /Annuler « Les Néons »/ })
    .getByRole('button', { name: 'Annuler la partie' })
    .click();

  await expect(
    page.getByRole('list', { name: 'Inscriptions des MJ des parties annulées' }),
  ).toHaveText('Sven · inscrit à\u00a0: «\u00a0Les Brumes\u00a0»');
});

test('un téléphone s’inscrit, l’Organisateur lance et publie le tirage, le téléphone montre sa table (TI-1, TI-5, TI-7)', async ({
  page,
  browser,
  baseURL,
}) => {
  await prepare(page);
  const phoneContext = await browser.newContext({ ...devices['Pixel 7'], baseURL });
  try {
    await followDraw(page, await phoneContext.newPage());
  } finally {
    await phoneContext.close();
  }
});

/** Le parcours, entre le bureau de l'Organisateur (`page`) et le téléphone du participant (`phone`). */
async function followDraw(page: Page, phone: Page) {
  const nickname = aNickname('Élodie');

  await identify(phone, nickname);
  await scheduleTab(phone).click();
  await timeSlotChip(phone, 1).click();
  await gameCard(phone, 'Les Brumes').click();
  await phone.getByRole('button', { name: "S'inscrire" }).click();
  await expect(phone.getByText('Inscription enregistrée')).toBeVisible();

  await page.goto('/gestion/');
  await page.getByRole('link', { name: 'Pilotage du jour J' }).click();
  await page.getByRole('button', { name: 'Lancer le tirage' }).click();
  await page
    .getByRole('alertdialog', { name: /^Lancer le tirage du créneau 1/ })
    .getByRole('button', { name: 'Lancer le tirage' })
    .click();

  const brumesCard = page
    .getByRole('list', { name: 'Plan de salle' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Les Brumes' }) });
  await expect(brumesCard).toContainText(nickname);

  // Le résultat provisoire ne se voit pas sur le téléphone (TI-5).
  await phone.goto('/');
  await expect(phone.getByRole('heading', { name: 'Tirage en cours' })).toBeVisible();
  await expect(phone.getByText('Table Griffon')).toBeHidden();

  await page.getByRole('button', { name: 'Publier le tirage' }).click();
  await page
    .getByRole('alertdialog', { name: /^Publier le tirage du créneau 1/ })
    .getByRole('button', { name: 'Publier le tirage' })
    .click();
  await expect(
    page.getByRole('group', { name: 'Créneaux de la journée' }).getByRole('button'),
  ).toContainText('Tirage publié');

  await phone.reload();
  const assignment = phone.getByRole('link', { name: /Table Griffon/ });
  await expect(assignment).toContainText('Tu joues à Les Brumes, avec Kaïros');
}

test('le tirage lancé du créneau suivant passe devant sa table sur le téléphone', async ({
  page,
  browser,
  baseURL,
}) => {
  // La journée du 13 mars 2027 : créneau 1 (9 h – 11 h 30) avec « Les Brumes », créneau 2 (14 h)
  // avec « Les Néons ». Le téléphone est à l'heure de Paris, réglée par le test.
  const body: UpdateConventionBody = { name: 'Chimères 2027', date: '2027-03-13' };
  const dated = await page.request.put(apiUrl(conventionEndpoints.update), { data: body });
  expect(dated.ok(), await dated.text()).toBe(true);
  await prepare(page);
  const { timeSlots } = await post<ConventionDto>(page, apiUrl(timeSlotEndpoints.add), {
    start: '14:00',
    end: '18:30',
  });
  await prepareNeons(page, timeSlots.find(({ start }) => start === '14:00')!.id);

  const phoneContext = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL,
    timezoneId: 'Europe/Paris',
  });
  try {
    const phone = await phoneContext.newPage();
    await phone.clock.install({ time: new Date('2027-03-13T08:00:00+01:00') });
    await identify(phone, aNickname('Maëlle'));
    await scheduleTab(phone).click();
    await timeSlotChip(phone, 1).click();
    await gameCard(phone, 'Les Brumes').click();
    await phone.getByRole('button', { name: "S'inscrire" }).click();
    await expect(phone.getByText('Inscription enregistrée')).toBeVisible();
    await phone.goBack();
    await timeSlotChip(phone, 2).click();
    await gameCard(phone, 'Les Néons').click();
    await phone.getByRole('button', { name: "S'inscrire" }).click();
    await expect(phone.getByText('Inscription enregistrée')).toBeVisible();

    await page.goto('/gestion/');
    await page.getByRole('link', { name: 'Pilotage du jour J' }).click();
    await drawTimeSlot(page, 1);
    await page.getByRole('button', { name: 'Publier le tirage' }).click();
    await page
      .getByRole('alertdialog', { name: /^Publier le tirage du créneau 1/ })
      .getByRole('button', { name: 'Publier le tirage' })
      .click();
    await page
      .getByRole('group', { name: 'Créneaux de la journée' })
      .getByRole('button', { name: /Créneau 2/ })
      .click();
    await drawTimeSlot(page, 2);

    // Avant même le début de sa partie, la carte passe au tirage du créneau 2.
    await phone.goto('/');
    await expect(phone.getByRole('region', { name: 'Tirage en cours' })).toContainText('Les Néons');
    await expect(phone.getByRole('region', { name: 'Ton programme' })).toContainText(
      'Table Griffon',
    );
  } finally {
    await phoneContext.close();
  }
});

/** Lance le tirage du créneau `rank`, choisi dans « Pilotage du jour J ». */
async function drawTimeSlot(page: Page, rank: number) {
  await page.getByRole('button', { name: 'Lancer le tirage' }).click();
  await page
    .getByRole('alertdialog', { name: new RegExp(`^Lancer le tirage du créneau ${rank}`) })
    .getByRole('button', { name: 'Lancer le tirage' })
    .click();
  await expect(page.getByRole('button', { name: 'Publier le tirage' })).toBeVisible();
}
