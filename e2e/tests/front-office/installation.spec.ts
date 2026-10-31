import { expect, test, type Page } from '@playwright/test';
import {
  aNickname,
  enterNickname,
  nicknameButton,
  skipInstallation,
  skipNotifications,
} from './identification.js';

/**
 * Ce que Chrome envoie à la page, et que Chromium sans écran n'envoie pas : `beforeinstallprompt`,
 * dont `prompt()` est noté dans `window.prompted`, et `appinstalled`.
 */
async function chromeSends(page: Page, type: 'beforeinstallprompt' | 'appinstalled') {
  await page.evaluate((type) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      prompt: async () => Object.assign(window, { prompted: true }),
    });
    window.dispatchEvent(event);
  }, type);
}

const installAdvice = (page: Page) => page.getByRole('region', { name: "Installe l'application" });

test('sur Android, « Installe l’application » suit les notifications ; son conseil reste sur l’Accueil jusqu’à son « Plus tard » (stories 35 à 37)', async ({
  page,
}) => {
  await enterNickname(page, aNickname('Élodie'));
  await expect(page.getByText('Étape suivante')).toBeVisible();
  await skipNotifications(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Installe l'application");
  await expect(page.getByText('Dernière étape')).toBeVisible();
  await expect(
    page.getByText(/Ouvre le menu du navigateur\s*, puis touche Ajouter à l'écran d'accueil/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Plus tard' }).click();

  await expect(nicknameButton(page)).toBeVisible();
  const advice = installAdvice(page);
  await expect(advice).toContainText('Conseil');
  await expect(page.getByRole('main').getByRole('region').first()).toHaveAccessibleName(
    "Installe l'application",
  );

  await advice.getByRole('button', { name: 'Plus tard' }).click();
  await expect(advice).toHaveCount(0);

  await page.reload();
  await expect(nicknameButton(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choisis tes parties' })).toBeVisible();
  await expect(installAdvice(page)).toHaveCount(0);
});

test('« Installer » ouvre la fenêtre de Chrome ; installée, l’application s’ouvre par un lien, ou reste proposée sur l’Accueil (stories 36, 38, 39)', async ({
  page,
}) => {
  await enterNickname(page, aNickname('Élodie'));
  await skipNotifications(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Installe l'application");

  await chromeSends(page, 'beforeinstallprompt');
  await page.getByRole('button', { name: 'Installer' }).click();
  expect(await page.evaluate(() => 'prompted' in window)).toBe(true);

  await chromeSends(page, 'appinstalled');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("L'application est installée");
  const open = page.getByRole('link', { name: "Ouvrir l'application" });
  await expect(open).toHaveAttribute('href', '/');
  await expect(open).toHaveAttribute('target', '_blank');

  await page.getByRole('button', { name: 'Rester dans le navigateur' }).click();
  const advice = page.getByRole('region', { name: "L'application est installée" });
  await expect(advice).toContainText('Tu es dans le navigateur');
  await expect(advice.getByRole('link', { name: "Ouvrir l'application" })).toHaveAttribute(
    'target',
    '_blank',
  );

  // Chrome envoie appinstalled deux fois, à quelques secondes d'écart.
  await chromeSends(page, 'appinstalled');
  await expect(nicknameButton(page)).toBeVisible();
  await expect(advice).toBeVisible();
});

test('l’étape d’installation ne revient pas à la réouverture', async ({ page }) => {
  await enterNickname(page, aNickname('Élodie'));
  await skipNotifications(page);
  await skipInstallation(page);

  await page.reload();

  await expect(nicknameButton(page)).toBeVisible();
  await expect(installAdvice(page)).toBeVisible();
});
