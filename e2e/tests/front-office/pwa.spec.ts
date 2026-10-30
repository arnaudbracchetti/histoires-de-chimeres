import { expect, test, type Page } from '@playwright/test';
import { apiUrl, frontOfficeEndpoints, linkedPhoneEndpoints } from '@chimeres/contract';
import { aNickname, identify, nicknameButton } from './identification.js';
import { gameCard, prepare, scheduleTab, timeSlotChip } from './schedule.js';

/** Attend que le service worker du front office contrôle la page. */
async function installServiceWorker(page: Page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('le service worker du front office laisse passer le back office', async ({ page }) => {
  await installServiceWorker(page);

  await page.goto('/gestion/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calendrier');

  await page.reload();
  await expect(page).toHaveTitle('Calendrier — Histoires de Chimères');
});

/** Les lectures de l'API que garde le service worker (`dataGroup` du front office). */
const cachedReads = (page: Page) =>
  page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.endsWith(':data:front-office:cache')) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths.sort();
  });
const personalReads = [
  apiUrl(linkedPhoneEndpoints.read),
  apiUrl(frontOfficeEndpoints.readSchedule),
];

test('le front office se charge hors ligne, et dit qu’il lui faut du réseau sans copie (story 117)', async ({
  page,
  context,
}) => {
  await installServiceWorker(page);

  await context.setOffline(true);
  await page.reload();

  // L'application démarre depuis le cache ; aucun pseudo n'y est relié.
  await expect(page).toHaveTitle('Histoires de Chimères');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Il faut du réseau');
});

test('le programme et ses fiches se lisent hors ligne après une lecture (story 114)', async ({
  page,
  context,
}) => {
  const { brumes } = await prepare(page);
  await installServiceWorker(page);
  const nickname = aNickname('Élodie');
  await identify(page, nickname);
  await scheduleTab(page).click();
  await expect(gameCard(page, brumes.title)).toBeVisible();
  await expect.poll(() => cachedReads(page)).toEqual(expect.arrayContaining(personalReads));

  await context.setOffline(true);
  await page.reload();

  await expect(nicknameButton(page)).toHaveText(nickname);
  await timeSlotChip(page, 1).click();
  await gameCard(page, brumes.title).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(brumes.title);
  await expect(page.getByText(/Une enquête/)).toBeVisible();
});

test('changer de pseudo oublie la copie hors ligne de l’ancien pseudo (ID-9)', async ({
  page,
  context,
}) => {
  const { brumes } = await prepare(page);
  await installServiceWorker(page);
  const nickname = aNickname('Brann');
  await identify(page, nickname);
  await scheduleTab(page).click();
  await expect(gameCard(page, brumes.title)).toBeVisible();
  await expect.poll(() => cachedReads(page)).toEqual(expect.arrayContaining(personalReads));

  await nicknameButton(page).click();
  await page
    .getByRole('dialog', { name: 'Ton pseudo' })
    .getByRole('button', { name: 'Changer de pseudo' })
    .click();
  await page
    .getByRole('alertdialog', { name: /^Changer de pseudo/ })
    .getByRole('button', { name: 'Changer de pseudo' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
  await expect
    .poll(() => cachedReads(page))
    .not.toEqual(expect.arrayContaining([personalReads[1]]));

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Il faut du réseau');
  await expect(page.getByText(nickname)).toHaveCount(0);
});

test('le service worker précharge les polices', async ({ page }) => {
  await installServiceWorker(page);

  // Le groupe « app » (installMode: prefetch) les télécharge à l'installation, que la page s'en serve ou non.
  const prefetched = () =>
    page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        if (!name.includes(':app:')) continue;
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
      }
      return urls.filter((url) => url.endsWith('.woff2')).length;
    });
  await expect.poll(prefetched).toBe(2);
});
