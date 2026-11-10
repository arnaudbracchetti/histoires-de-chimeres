import { request, type Page } from '@playwright/test';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  drawEndpoints,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  signUpEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type ScenarioDto,
  type ScheduleDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';
import { expectOk, post } from './api.js';

/**
 * Par l'API : un créneau, la table « Griffon », « Les Brumes » de Kaïros programmée à cette table,
 * et deux téléphones : « Élodie », inscrite aux Brumes, et « Sven », inscrit nulle part. L'id du
 * créneau.
 */
async function prepare(page: Page, baseURL: string) {
  const api = page.request;
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
  await expectOk(api.put(apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId })));
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
  const { games } = await post<ScheduleDto>(page, apiUrl(scheduleEndpoints.schedule), {
    scenarioId: brumes.id,
    timeSlotId,
    tableId: tables[0]!.id,
  });
  const { presenceCode } = (await (
    await expectOk(api.get(apiUrl(conventionEndpoints.read)))
  ).json()) as ConventionDto;

  /** Un téléphone, par l'API : son propre contexte garde son cookie. */
  const phone = async (nickname: string) => {
    const context = await request.newContext({ baseURL });
    await expectOk(
      context.post(apiUrl(linkedPhoneEndpoints.link), {
        data: { presenceCode, nickname, confirmation: null },
      }),
    );
    return context;
  };
  const elodie = await phone('Élodie');
  await expectOk(elodie.put(apiUrl(signUpEndpoints.signUp, { gameId: games[0]!.id })));
  const sven = await phone('Sven');
  await Promise.all([elodie.dispose(), sven.dispose()]);
  return timeSlotId;
}

const search = (page: Page) =>
  page.getByRole('searchbox', { name: "Pseudo ou titre d'une partie" });

const nicknames = (page: Page) => page.locator('tbody th .nickname');

test('l’Organisateur retrouve un pseudo par une partie de son nom ou par le titre d’une partie (ID-5, ID-7)', async ({
  page,
  baseURL,
}) => {
  await prepare(page, baseURL!);

  await page.goto('/gestion/');
  await page.getByRole('link', { name: 'Participants' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Participants' })).toBeVisible();
  await expect(
    page.getByText("Tape quelques lettres du pseudo, ou du titre d'une partie où il est inscrit."),
  ).toBeVisible();
  await expect(nicknames(page)).toHaveText(['Élodie', 'Kaïros', 'Sven']);
  const kairos = page.getByRole('row', { name: /Kaïros/ });
  await expect(kairos.getByRole('rowheader')).toContainText('MJ');
  const elodie = page.getByRole('row', { name: /Élodie/ });
  await expect(elodie).toContainText('Créneau 1 · inscriptions ouvertes : 1 inscription');
  await expect(elodie.getByRole('cell').last()).toHaveText('1');

  await search(page).fill('ELO');
  await expect(nicknames(page)).toHaveText(['Élodie']);

  await search(page).fill('brume');
  await expect(nicknames(page)).toHaveText(['Élodie']);
  await expect(page.getByText('inscrit à « Les Brumes »')).toBeVisible();

  await search(page).fill('zz');
  await expect(page.getByText('Aucun pseudo ne correspond')).toBeVisible();
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(nicknames(page)).toHaveText(['Élodie', 'Kaïros', 'Sven']);
});

test('l’Organisateur ouvre la fiche d’un pseudo et lit son résultat publié (ID-5)', async ({
  page,
  baseURL,
}) => {
  const timeSlotId = await prepare(page, baseURL!);
  for (const endpoint of [drawEndpoints.launch, drawEndpoints.publish]) {
    await expectOk(page.request.post(apiUrl(endpoint, { timeSlotId })));
  }

  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Élodie' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Élodie' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: "Fil d'Ariane" })).toContainText(
    'Participants',
  );
  await expect(page.getByText('Participant', { exact: true })).toBeVisible();
  const program = page.getByRole('tabpanel');
  await expect(program.getByRole('listitem')).toHaveCount(1);
  await expect(program).toContainText('Tirage publié');
  await expect(program).toContainText('Table Griffon');
  await expect(program).toContainText('Les Brumes, avec Kaïros');

  await page.getByRole('tab', { name: /Téléphones/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText(/^Relié à \d{1,2}\u00a0h\u00a0\d{2}$/);
});

test('l’Organisateur crée un pseudo et arrive sur sa fiche (ID-12)', async ({ page, baseURL }) => {
  await prepare(page, baseURL!);
  await page.goto('/gestion/participants');

  await page.getByRole('button', { name: 'Créer un pseudo' }).click();
  const field = page.getByRole('textbox', { name: 'Pseudo du nouveau participant' });
  await expect(field).toBeFocused();
  await field.fill('Lune');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { level: 1, name: 'Lune' })).toBeVisible();
  await expect(page.getByText('Participant', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: "Fil d'Ariane" }).getByRole('link').click();
  await expect(nicknames(page)).toHaveText(['Élodie', 'Kaïros', 'Lune', 'Sven']);
});

test('un pseudo pris est refusé sous le champ, sans rien décaler, avec « Voir sa fiche » (ID-4, ID-12)', async ({
  page,
  baseURL,
}) => {
  await prepare(page, baseURL!);
  await page.goto('/gestion/participants');
  await page.getByRole('button', { name: 'Créer un pseudo' }).click();
  const field = page.getByRole('textbox', { name: 'Pseudo du nouveau participant' });
  const cancel = await page.getByRole('button', { name: 'Annuler' }).boundingBox();
  const sven = await nicknames(page).last().boundingBox();

  await field.fill('kairos');
  await page.keyboard.press('Enter');

  await expect(field).toHaveAccessibleDescription(/^Le MJ «\s*Kaïros\s*» porte déjà ce pseudo/);
  expect(await page.getByRole('button', { name: 'Annuler' }).boundingBox()).toEqual(cancel);
  expect(await nicknames(page).last().boundingBox()).toEqual(sven);
  await expect(page.getByRole('link', { name: 'Voir sa fiche' })).toHaveAttribute(
    'href',
    /\/gestion\/participants\/.+/,
  );

  await field.fill('ELODIE');
  await page.keyboard.press('Enter');
  await expect(field).toHaveAccessibleDescription(/^Le participant «\s*Élodie\s*»/);
  await page.getByRole('link', { name: 'Voir sa fiche' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Élodie' })).toBeVisible();
});

test('l’Organisateur renomme un pseudo en place, même après la publication, et un nom pris est refusé avec « Voir sa fiche » (ID-13)', async ({
  page,
  baseURL,
}) => {
  const timeSlotId = await prepare(page, baseURL!);
  for (const endpoint of [drawEndpoints.launch, drawEndpoints.publish]) {
    await expectOk(page.request.post(apiUrl(endpoint, { timeSlotId })));
  }
  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Élodie' }).click();

  await page.getByRole('button', { name: 'Modifier le pseudo' }).click();
  const field = page.getByRole('textbox', { name: 'Pseudo du participant' });
  await expect(field).toBeFocused();
  await field.fill('sven');
  await page.keyboard.press('Enter');
  await expect(field).toHaveAccessibleDescription(/^Le participant «\s*Sven\s*»/);
  await expect(page.getByRole('link', { name: 'Voir sa fiche' })).toHaveAttribute(
    'href',
    /\/gestion\/participants\/.+/,
  );

  await field.fill('Élodie la Rouge');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { level: 1, name: 'Élodie la Rouge' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier le pseudo' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Table Griffon');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Élodie la Rouge' })).toBeVisible();
});

test('l’Organisateur inscrit un pseudo depuis sa fiche, puis le désinscrit, sans confirmation (ID-12)', async ({
  page,
  baseURL,
}) => {
  await prepare(page, baseURL!);
  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Sven' }).click();

  await expect(page.getByRole('tabpanel')).toContainText('Aucune inscription');
  await page.getByRole('button', { name: /^Modifier les inscriptions/ }).click();

  const signUps = page.getByRole('tabpanel');
  await expect(page.getByRole('tab', { name: /Inscriptions/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(signUps.getByRole('radio', { name: /Créneau 1/ })).toBeChecked();
  const brumes = signUps.getByRole('checkbox', { name: 'Les Brumes' });
  await expect(signUps).toContainText('1 inscrit · 1 à 5 places');
  await brumes.check();
  await expect(signUps).toContainText('2 inscrits · 1 à 5 places');
  await expect(page.getByRole('tab', { name: /Inscriptions/ })).toContainText('1');

  await brumes.uncheck();
  await expect(signUps).toContainText('1 inscrit · 1 à 5 places');
  await page.getByRole('tab', { name: /Programme/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Aucune inscription');
});

test('la partie d’un MJ est grisée, « sa partie », sur la fiche de son pseudo (IN-4)', async ({
  page,
  baseURL,
}) => {
  await prepare(page, baseURL!);
  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Kaïros' }).click();

  await page.getByRole('tab', { name: /Inscriptions/ }).click();

  const signUps = page.getByRole('tabpanel');
  await expect(signUps.getByRole('checkbox', { name: /Les Brumes/ })).toBeDisabled();
  await expect(signUps).toContainText('sa partie');
  await expect(signUps).toContainText(
    'Mène « Les Brumes » : ses inscriptions sur ce créneau sont de secours.',
  );
});

test('l’Organisateur rouvre les inscriptions d’un tirage provisoire depuis la fiche, puis inscrit le retardataire (TI-6, ID-12)', async ({
  page,
  baseURL,
}) => {
  const timeSlotId = await prepare(page, baseURL!);
  await expectOk(page.request.post(apiUrl(drawEndpoints.launch, { timeSlotId })));
  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Élodie' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Table Griffon');
  await expect(page.getByRole('button', { name: /^Rouvrir les inscriptions/ })).toHaveCount(0);

  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Kaïros' }).click();
  await expect(page.getByRole('tabpanel')).toContainText(/Mène «?\s*Les Brumes/);
  await expect(page.getByRole('button', { name: /^Rouvrir les inscriptions/ })).toHaveCount(0);

  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Sven' }).click();
  const program = page.getByRole('tabpanel');
  await expect(program).toContainText('Pas dans le tirage');
  await page.getByRole('button', { name: /^Rouvrir les inscriptions/ }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Rouvrir les inscriptions du créneau 1 ?' });
  await expect(dialog).toContainText(
    'Le résultat provisoire sera effacé, avec ses déplacements et ses parties annulées.',
  );
  await expect(dialog).not.toContainText('Sven');
  await dialog.getByRole('button', { name: 'Rouvrir les inscriptions' }).click();

  await expect(dialog).toBeHidden();
  await expect(program).toContainText('Inscriptions ouvertes');
  await expect(program).toContainText('Aucune inscription');
  const editSignUps = page.getByRole('button', { name: /^Modifier les inscriptions/ });
  await expect(editSignUps).toBeFocused();
  expect(await editSignUps.evaluate((button) => button.matches(':focus-visible'))).toBe(true);
  await editSignUps.click();
  await page.getByRole('tabpanel').getByRole('checkbox', { name: 'Les Brumes' }).check();
  await expect(page.getByRole('tabpanel')).toContainText('2 inscrits · 1 à 5 places');
});

test('l’Organisateur ajoute un retardataire à un tirage publié, comme non placé (ID-14)', async ({
  page,
  baseURL,
}) => {
  const timeSlotId = await prepare(page, baseURL!);
  for (const endpoint of [drawEndpoints.launch, drawEndpoints.publish]) {
    await expectOk(page.request.post(apiUrl(endpoint, { timeSlotId })));
  }
  const addLatecomer = page.getByRole('button', { name: /^Ajouter comme non placé/ });
  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Élodie' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Table Griffon');
  await expect(addLatecomer).toHaveCount(0);

  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Kaïros' }).click();
  await expect(page.getByRole('tabpanel')).toContainText(/Mène «?\s*Les Brumes/);
  await expect(addLatecomer).toHaveCount(0);

  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Sven' }).click();
  const program = page.getByRole('tabpanel');
  await expect(program).toContainText('Pas dans le tirage');
  await addLatecomer.click();

  const dialog = page.getByRole('alertdialog', {
    name: 'Ajouter « Sven » au tirage publié du créneau 1 ?',
  });
  await expect(dialog).toContainText("L'ajout ne se défait pas.");
  await dialog.getByRole('button', { name: 'Ajouter comme non placé' }).click();

  await expect(dialog).toBeHidden();
  await expect(program).toContainText('Non placé');
  await expect(program).toContainText('Il reste de la place à Griffon (4).');
  await expect(addLatecomer).toHaveCount(0);

  await page.goto('/gestion/pilotage');
  await expect(page.getByText('1 non placé', { exact: true })).toBeVisible();
});

test('l’Organisateur coupe les liens d’un pseudo depuis le menu « ⋯ » ; son téléphone revient à l’identification (ID-5, ID-8)', async ({
  page,
  baseURL,
}) => {
  await prepare(page, baseURL!);
  const { presenceCode } = (await (
    await expectOk(page.request.get(apiUrl(conventionEndpoints.read)))
  ).json()) as ConventionDto;
  const phone = await request.newContext({ baseURL });
  await expectOk(
    phone.post(apiUrl(linkedPhoneEndpoints.link), {
      data: { presenceCode, nickname: 'Élodie', confirmation: 'participant' },
    }),
  );
  const menu = page.getByRole('button', { name: 'Autres actions sur le pseudo' });
  const phonesTab = page.getByRole('tab', { name: /Téléphones/ });
  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Kaïros' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kaïros' })).toBeVisible();
  await expect(menu).toHaveCount(0);

  await page.goto('/gestion/participants');
  await page.getByRole('link', { name: 'Élodie' }).click();
  await expect(phonesTab).toContainText('2');
  await menu.click();
  await page.getByRole('menuitem', { name: 'Couper les liens' }).click();

  await expect(phonesTab).toContainText('0');
  await expect(menu).toHaveCount(0);
  await phonesTab.click();
  await expect(page.getByRole('tabpanel')).toContainText('Aucun téléphone relié');
  expect((await phone.get(apiUrl(linkedPhoneEndpoints.read))).status()).toBe(401);
  await phone.dispose();
});
