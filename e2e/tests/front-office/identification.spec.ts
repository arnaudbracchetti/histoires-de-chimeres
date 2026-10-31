import { expect, test } from '@playwright/test';
import {
  apiUrl,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  PRESENCE_CODE_PARAM,
  type LinkPhoneBody,
} from '@chimeres/contract';
import {
  aNickname,
  enterNickname,
  identify,
  nicknameButton,
  presenceCodeOf,
  skipInstallation,
  skipNotifications,
} from './identification.js';

test('un pseudo nouveau relie le téléphone, qui le garde à la réouverture (ID-1)', async ({
  page,
}) => {
  const nickname = aNickname('Élodie');

  await identify(page, `  ${nickname} `);

  await expect(nicknameButton(page)).toHaveText(nickname);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choisis tes parties' })).toBeVisible();
  await page.goto('/');
  await expect(nicknameButton(page)).toHaveText(nickname);
});

test('un pseudo vide ou trop long est signalé sous le champ', async ({ page }) => {
  await page.goto(`/?${PRESENCE_CODE_PARAM}=${await presenceCodeOf(page.request)}`);
  const field = page.getByLabel('Pseudo', { exact: true });

  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(field).toHaveAccessibleDescription('Tape ton pseudo.');

  await field.fill('a'.repeat(31));
  await expect(field).toHaveAccessibleDescription(/^Ton pseudo fait 30.caractères au plus/);
});

test('une erreur ne décale rien : le bouton reste sous le pouce', async ({ page }) => {
  await page.goto(`/?${PRESENCE_CODE_PARAM}=${await presenceCodeOf(page.request)}`);
  const field = page.getByLabel('Pseudo', { exact: true });
  const button = page.getByRole('button', { name: 'Continuer' });
  const before = await button.boundingBox();

  await button.click();
  await expect(field).toHaveAccessibleDescription('Tape ton pseudo.');
  expect(await button.boundingBox()).toEqual(before);

  await field.fill('a'.repeat(31));
  await expect(field).toHaveAccessibleDescription(/^Ton pseudo fait 30.caractères au plus/);
  expect(await button.boundingBox()).toEqual(before);
});

test('un pseudo existant demande une confirmation avant de relier le téléphone (ID-1, ID-7)', async ({
  page,
  request,
}) => {
  // Créé depuis un autre téléphone : le contexte de requêtes `request` a ses propres cookies.
  const nickname = aNickname('Élodie');
  const body: LinkPhoneBody = {
    presenceCode: await presenceCodeOf(request),
    nickname,
    confirmation: null,
  };
  expect((await request.post(apiUrl(linkedPhoneEndpoints.link), { data: body })).ok()).toBe(true);

  await enterNickname(page, nickname.replace('Élodie', 'elodie'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ce pseudo existe déjà');
  await expect(page.getByText(nickname, { exact: true })).toBeVisible();
  await expect(page.getByText("demande à un Organisateur, à l'accueil")).toBeVisible();

  await page.getByRole('button', { name: 'Non, choisir un autre pseudo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
  await expect(page.getByLabel('Pseudo', { exact: true })).toHaveValue(
    nickname.replace('Élodie', 'elodie'),
  );

  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: "Oui, c'est moi" }).click();
  await skipNotifications(page);
  await skipInstallation(page);
  // Affiché tel qu'il a été créé.
  await expect(nicknameButton(page)).toHaveText(nickname);
});

test('le pseudo d’un MJ demande « Es-tu bien ce MJ ? » avant de relier le téléphone (ID-3)', async ({
  page,
  request,
}) => {
  // Créé par un Organisateur, dans le back office.
  const nickname = aNickname('Brann');
  expect((await request.post(apiUrl(gameMasterEndpoints.add), { data: { nickname } })).ok()).toBe(
    true,
  );

  await enterNickname(page, nickname.toLowerCase());
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Es-tu bien ce MJ.\?$/);
  await expect(page.getByText(nickname, { exact: true })).toBeVisible();
  await expect(page.getByText('les parties que tu mènes')).toBeVisible();
  await expect(page.getByText("demande à un Organisateur, à l'accueil")).toBeVisible();

  await page.getByRole('button', { name: 'Non, choisir un autre pseudo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');

  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: "Oui, c'est moi" }).click();
  await skipNotifications(page);
  await skipInstallation(page);
  await expect(nicknameButton(page)).toHaveText(nickname);
});

test('changer de pseudo coupe le lien du téléphone et revient à l’identification (ID-9)', async ({
  page,
}) => {
  const nickname = aNickname('Brann');
  await identify(page, nickname);

  await nicknameButton(page).click();
  const box = page.getByRole('dialog', { name: 'Ton pseudo' });
  await expect(box).toContainText(nickname);
  await box.getByRole('button', { name: 'Changer de pseudo' }).click();

  const confirmation = page.getByRole('alertdialog', { name: /^Changer de pseudo/ });
  await expect(confirmation).toContainText('restent sous ce pseudo');
  await confirmation.getByRole('button', { name: 'Changer de pseudo' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ton pseudo');
});

test.describe('onglets', () => {
  test('un onglet se pose sur l’Accueil sans s’empiler : le retour remonte à l’Accueil', async ({
    page,
  }) => {
    await identify(page, aNickname('Kaïros'));
    const tabs = page.getByRole('navigation', { name: 'Navigation principale' });
    const current = tabs.locator('[aria-current="page"]');
    await expect(current).toHaveText('Accueil');

    await page.getByRole('link', { name: 'Voir le programme' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Programme');
    await tabs.getByRole('link', { name: 'Mes parties' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes parties');
    await expect(current).toHaveText('Mes parties');

    await page.goBack();
    await expect(current).toHaveText('Accueil');
    await expect(page).toHaveURL((url) => url.pathname === '/');

    await tabs.getByRole('link', { name: 'Programme' }).click();
    await tabs.getByRole('link', { name: 'Accueil' }).click();
    await expect(current).toHaveText('Accueil');
    await page.goBack();
    await expect(page).not.toHaveURL((url) => url.pathname === '/programme');
  });

  test('un écran ouvert directement a l’Accueil recréé dessous', async ({ page }) => {
    await identify(page, aNickname('Morgane'));
    await expect(nicknameButton(page)).toBeVisible();

    await page.goto('/mes-parties');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes parties');

    await page.goBack();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { name: 'Choisis tes parties' })).toBeVisible();
  });
});
