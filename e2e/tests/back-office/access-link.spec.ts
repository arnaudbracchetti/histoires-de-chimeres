import {
  apiUrl,
  participantEndpoints,
  type ParticipantSheetDto,
  type AddedParticipantDto,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';
import { expectOk, post } from './api.js';

const PASSWORD = 'la chimère dort sous le pont';

/**
 * Le seul parcours de vraie connexion (ADR 0020) : l'Organisateur crée un lien d'accès, une autre
 * personne, sans session, y choisit son mot de passe, se déconnecte, puis se reconnecte par son
 * pseudo et ce mot de passe (ID-6, ADR 0018).
 */
test("lien d'accès : choisir son mot de passe, puis se reconnecter (ID-6)", async ({
  page,
  browser,
}) => {
  const { participantId: id } = await post<AddedParticipantDto>(
    page,
    apiUrl(participantEndpoints.add),
    { nickname: 'Lune' },
  );
  await expectOk(
    page.request.put(apiUrl(participantEndpoints.appointOrganizer, { participantId: id })),
  );
  await page.goto(`/gestion/participants/${id}`);
  await page.getByRole('tab', { name: /Compte/ }).click();
  await expect(page.getByText('Lien à créer')).toBeVisible();

  await page.getByRole('button', { name: "Créer le lien d'accès" }).click();

  const dialog = page.getByRole('dialog', { name: /Lien d.accès de «\s?Lune\s?»/ });
  await expect(dialog.getByRole('img', { name: "QR code du lien d'accès" })).toBeVisible();
  await expect(dialog.getByText(/Valable jusqu'au .*, une seule fois/)).toBeVisible();
  const url = await dialog.getByRole('textbox', { name: "Lien d'accès" }).inputValue();
  expect(url).toMatch(/\/gestion\/lien-d-acces\/[\w-]{43}$/);
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByText(/En attente · encore 7\sjours/)).toBeVisible();

  // Une autre personne, sur un autre navigateur : aucune session.
  const other = await browser.newContext();
  const lune = await other.newPage();
  const response = await lune.goto(url);
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  await expect(lune.getByRole('heading', { name: 'Lune, choisis ton mot de passe' })).toBeVisible();
  await expect(lune.getByRole('textbox', { name: 'Pseudo' })).toHaveValue('Lune');
  await expect(lune.getByRole('textbox', { name: 'Pseudo' })).toHaveAttribute('readonly', '');
  await expect(lune.getByLabel('Mot de passe', { exact: true })).toBeFocused();
  await lune.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await lune.getByLabel('Mot de passe, une seconde fois').fill(PASSWORD);
  await lune.getByRole('button', { name: 'Choisir ce mot de passe' }).click();

  const rail = lune.locator('app-rail');
  await expect(rail.getByText('Lune', { exact: true })).toBeVisible();
  await rail.getByRole('button', { name: 'Se déconnecter' }).click();

  await expect(lune.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await lune.getByLabel('Pseudo').fill('lune');
  await lune.getByLabel('Mot de passe').fill(PASSWORD);
  await lune.getByRole('button', { name: 'Se connecter' }).click();
  await expect(rail.getByText('Lune', { exact: true })).toBeVisible();
  await other.close();

  await page.reload();
  await page.getByRole('tab', { name: /Compte/ }).click();
  await expect(page.getByText('Compte actif')).toBeVisible();
});
