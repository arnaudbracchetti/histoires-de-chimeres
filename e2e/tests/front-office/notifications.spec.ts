import { expect, test, type Page } from '@playwright/test';
import { frontOfficeUrls } from '@chimeres/contract';
import {
  aNickname,
  enterNickname,
  identify,
  nicknameButton,
  skipInstallation,
} from './identification.js';
import { prepare } from './schedule.js';

const banner = (page: Page) => page.getByRole('button', { name: /pour connaître ta table$/ });

test('passer les notifications demande une confirmation, puis le bandeau les rappelle (NO-6)', async ({
  page,
}) => {
  await enterNickname(page, aNickname('Élodie'));

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Active les notifications');
  await expect(page.getByText('Ta table', { exact: true })).toBeVisible();
  await expect(page.getByText('Exemple de notification')).toBeVisible();
  await expect(page.getByText(/^Ton téléphone va te demander l'autorisation/)).toBeVisible();
  await expect(page.getByText('partie très demandée')).toHaveCount(0);

  await page.getByRole('button', { name: 'Plus tard' }).click();
  const question = page.getByRole('alertdialog', { name: /^Continuer sans notifications/ });
  await expect(question).toContainText('tu ne sauras ni ta table');
  await expect(question.getByRole('button').first()).toHaveText('Activer les notifications');
  await question.getByRole('button', { name: 'Continuer sans' }).click();
  await skipInstallation(page);

  await expect(nicknameButton(page)).toBeVisible();
  await expect(banner(page)).toHaveText('Active les notifications pour connaître ta table');
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Programme' })
    .click();
  await expect(banner(page)).toBeVisible();

  await banner(page).click();
  const guide = page.getByRole('dialog', { name: 'Active les notifications' });
  await expect(guide.getByRole('button', { name: 'Activer les notifications' })).toBeVisible();
  await guide.getByRole('button', { name: 'Fermer' }).click();
  await expect(guide).toBeHidden();
});

test('un refus mène à « Notifications bloquées », avec le chemin des réglages du navigateur (§4.2, NO-6)', async ({
  page,
}) => {
  await enterNickname(page, aNickname('Élodie'));

  await page.getByRole('button', { name: 'Activer les notifications' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notifications bloquées');
  await expect(page.getByText(/à gauche de l'adresse, en haut du navigateur/)).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await skipInstallation(page);

  await expect(banner(page)).toHaveText(
    /^Notifications bloquées.: réactive-les dans les réglages pour connaître ta table$/,
  );
  await banner(page).click();
  const guide = page.getByRole('dialog', { name: 'Notifications bloquées' });
  await expect(guide).toContainText('Pour les réactiver');
  await expect(guide).toContainText('Autorisations');
});

test('un téléphone sans push passe l’étape des notifications, et a un bandeau sans guide (NO-6)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as { PushManager?: unknown }).PushManager;
  });
  await enterNickname(page, aNickname('Élodie'));
  await skipInstallation(page);

  await expect(nicknameButton(page)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    /^Ce téléphone ne reçoit pas les notifications.: reviens voir ta table ici après chaque tirage$/,
  );
  await expect(banner(page)).toHaveCount(0);
});

test('l’étape des notifications ne revient pas à la réouverture', async ({ page }) => {
  await identify(page, aNickname('Élodie'));

  await page.reload();

  await expect(nicknameButton(page)).toBeVisible();
  await expect(banner(page)).toBeVisible();
});

test('le tap d’une notification ouvre la fiche, et le retour mène à l’Accueil (story 52)', async ({
  page,
}) => {
  const { brumes } = await prepare(page);
  await identify(page, aNickname('Élodie'));
  await expect(nicknameButton(page)).toBeVisible();

  // Le service worker ouvre l'adresse de la notification dans l'application (`navigateLastFocusedOrOpen`).
  await page.goto(frontOfficeUrls.game(brumes.gameId));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(brumes.title);

  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(page.getByRole('heading', { name: 'Choisis tes parties' })).toBeVisible();
});
