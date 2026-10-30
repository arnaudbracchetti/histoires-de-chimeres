import { expect, test } from '@playwright/test';
import {
  apiUrl,
  frontOfficeEndpoints,
  linkedPhoneEndpoints,
  signUpEndpoints,
  type FrontOfficeScheduleDto,
} from '@chimeres/contract';
import { aNickname, identify, presenceCodeOf } from './identification.js';
import { gameCard, prepare, scheduleTab, timeSlotChip } from './schedule.js';

test('Mes parties montre les inscriptions du créneau, avec le rappel « partie très demandée » (IN-5)', async ({
  page,
  request,
}) => {
  const { brumes } = await prepare(page, { brumesSeats: { min: 1, max: 1 } });
  await identify(page, aNickname('Élodie'));
  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();
  await gameCard(page, brumes.title).click();
  await page.getByRole('button', { name: "S'inscrire" }).click();
  await expect(page.getByText('Inscription enregistrée')).toBeVisible();

  // Un autre téléphone, avec ses propres cookies, fait passer la partie au-dessus de sa place.
  const link = await request.post(apiUrl(linkedPhoneEndpoints.link), {
    data: {
      presenceCode: await presenceCodeOf(request),
      nickname: aNickname('Yanis'),
      confirmation: null,
    },
  });
  expect(link.ok()).toBe(true);
  const schedule = (await (
    await request.get(apiUrl(frontOfficeEndpoints.readSchedule))
  ).json()) as FrontOfficeScheduleDto;
  const gameId = schedule.games.find(({ title }) => title === brumes.title)!.id;
  expect((await request.put(apiUrl(signUpEndpoints.signUp, { gameId }))).ok()).toBe(true);

  await page.goto('/mes-parties');
  const timeSlot = page.getByRole('region', { name: /^Créneau 1\b/ });
  await expect(
    timeSlot.getByText(
      /^Ta seule inscription du créneau 1 est une partie très demandée.: inscris-toi aussi à une autre partie\.$/,
    ),
  ).toBeVisible();
  const signUp = timeSlot.getByRole('list', { name: 'Tes inscriptions' }).getByRole('link');
  await expect(signUp).toHaveCount(1);
  await expect(signUp).toContainText(brumes.title);
  await expect(signUp).toContainText('Très demandée');

  await signUp.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(brumes.title);
});
