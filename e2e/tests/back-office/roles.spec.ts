import {
  apiUrl,
  participantEndpoints,
  type ParticipantListEntryDto,
  type ParticipantSheetDto,
} from '@chimeres/contract';
import { expect, ORGANIZER_NICKNAME, test } from '../../fixtures.js';
import { expectOk, post } from './api.js';

test('donne puis retire le rôle MJ depuis l’onglet « Compte » (ID-16)', async ({ page }) => {
  const { id } = await post<ParticipantSheetDto>(page, apiUrl(participantEndpoints.add), {
    nickname: 'Lune',
  });
  await page.goto(`/gestion/participants/${id}`);
  const header = page.locator('app-page-header');
  await expect(header.getByText('Participant', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Compte/ }).click();
  await expect(page.getByText('Pas de compte')).toBeVisible();
  const gameMaster = page.getByRole('checkbox', { name: /MJ/ });
  // La case ne change qu'avec la fiche relue : un clic, puis l'état attendu.
  await gameMaster.click();

  await expect(gameMaster).toBeChecked();
  await expect(header.getByText('MJ', { exact: true })).toBeVisible();
  await expect(page.getByText('Ce pseudo a un compte du back office.')).toBeVisible();

  await gameMaster.click();
  const dialog = page.getByRole('alertdialog', { name: 'Retirer le rôle MJ à « Lune » ?' });
  await expect(dialog.getByText('Ses disponibilités seront supprimées.')).toBeVisible();
  await expect(dialog.getByText(/son compte sera supprimé/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Retirer le rôle MJ' }).click();

  await expect(dialog).toBeHidden();
  await expect(gameMaster).not.toBeChecked();
  await expect(header.getByText('Participant', { exact: true })).toBeVisible();
  await expect(page.getByText('Pas de compte')).toBeVisible();
});

test('un Organisateur ne peut pas se retirer lui-même le rôle d’Organisateur', async ({ page }) => {
  const response = await expectOk(
    page.request.get(apiUrl(participantEndpoints.list), {
      params: { search: ORGANIZER_NICKNAME },
    }),
  );
  const [me] = (await response.json()) as ParticipantListEntryDto[];
  await page.goto(`/gestion/participants/${me!.id}`);

  await page.getByRole('tab', { name: /Compte/ }).click();

  const organizer = page.getByRole('checkbox', { name: /Organisateur/ });
  await expect(organizer).toBeChecked();
  await expect(organizer).toBeDisabled();
  await expect(page.getByText(/Tu ne peux pas te retirer ce rôle/)).toBeVisible();
});
