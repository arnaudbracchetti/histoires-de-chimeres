import { expect, test } from '@playwright/test';
import {
  apiUrl,
  conventionEndpoints,
  frontOfficeEndpoints,
  linkedPhoneEndpoints,
  PRESENCE_CODE_PARAM,
  signUpEndpoints,
  type ConventionDto,
  type FrontOfficeScheduleDto,
} from '@chimeres/contract';
import { loadFont } from '../fonts.js';
import { aNickname, identify, presenceCodeOf } from './identification.js';
import { prepare, timeSlotChip } from './schedule.js';

test('le front office demande le pseudo, avec le code de présence', async ({ page }) => {
  const convention = (await (
    await page.request.get(apiUrl(conventionEndpoints.read))
  ).json()) as ConventionDto;

  await page.goto(`/?${PRESENCE_CODE_PARAM}=${convention.presenceCode}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
});

test('un lien profond retombe sur le front office', async ({ page }) => {
  await page.goto('/une/route');

  await expect(page).toHaveTitle('Histoires de Chimères');
});

test("le front office sert ses polices et l'icône de PWA", async ({ page, baseURL }) => {
  const fonts: string[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('.woff2') && response.ok()) fonts.push(response.url());
  });
  await page.goto('/');

  expect(await loadFont(page, 'Uncial Antiqua')).toBe(true);
  expect(await loadFont(page, 'Aldrich')).toBe(true);
  // Hébergées avec l'application, jamais chargées depuis Google Fonts.
  expect(fonts).toHaveLength(2);
  for (const url of fonts) expect(new URL(url).origin).toBe(new URL(baseURL!).origin);

  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  const icon = manifest.icons.find(
    (i: { sizes: string; purpose: string }) => i.sizes === '512x512' && i.purpose === 'any',
  );
  const response = await page.request.get(`/${icon.src}`);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/png');
});

test.describe('Accueil', () => {
  test('« Choisis tes parties » mène au programme (story 59)', async ({ page }) => {
    await prepare(page);
    await identify(page, aNickname('Inès'));

    const card = page.getByRole('region', { name: 'Choisis tes parties' });
    await expect(card).toContainText('Chaque créneau est tiré au sort peu avant son début.');
    await card.getByRole('link', { name: 'Voir le programme' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programme');
  });

  test('« Ton programme » montre les inscriptions du créneau, avec le rappel « partie très demandée » (story 60, IN-5)', async ({
    page,
    request,
  }) => {
    const { brumes } = await prepare(page, { brumesSeats: { min: 1, max: 1 } });
    await identify(page, aNickname('Malo'));
    const schedule = (await (
      await page.request.get(apiUrl(frontOfficeEndpoints.readSchedule))
    ).json()) as FrontOfficeScheduleDto;
    const gameId = schedule.games.find(({ title }) => title === brumes.title)!.id;
    // Le téléphone de la page s'inscrit, puis un autre fait passer la partie au-dessus de sa place.
    expect((await page.request.put(apiUrl(signUpEndpoints.signUp, { gameId }))).ok()).toBe(true);
    const link = await request.post(apiUrl(linkedPhoneEndpoints.link), {
      data: {
        presenceCode: await presenceCodeOf(request),
        nickname: aNickname('Yanis'),
        confirmation: null,
      },
    });
    expect(link.ok()).toBe(true);
    expect((await request.put(apiUrl(signUpEndpoints.signUp, { gameId }))).ok()).toBe(true);

    await page.goto('/');
    const line = page
      .getByRole('region', { name: 'Ton programme' })
      .getByRole('link', { name: /^Créneau 1\b/ });
    await expect(line).toContainText('1 inscription');
    await expect(line).toContainText(brumes.title);
    await expect(line).toContainText(
      /Ta seule inscription du créneau 1 est une partie très demandée.: inscris-toi aussi à une autre partie\./,
    );

    await line.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programme');
    await expect(timeSlotChip(page, 1)).toHaveAttribute('aria-current', 'true');
  });
});
