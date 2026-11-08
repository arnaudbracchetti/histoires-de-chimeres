import { request, type Page } from '@playwright/test';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
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
 * et deux téléphones : « Élodie », inscrite aux Brumes, et « Sven », inscrit nulle part.
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
  const brumes = await post<ScenarioDto>(page, apiUrl(scenarioEndpoints.propose, { gameMasterId }), {
    title: 'Les Brumes',
    system: "L'Appel de Cthulhu",
    presentation: 'Une enquête sous la brume.',
    contentWarnings: '',
    seats: { min: 1, max: 5 },
    duration: 1,
  });
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
    page.getByText(
      "Tape quelques lettres du pseudo, ou du titre d'une partie où il est inscrit.",
    ),
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
