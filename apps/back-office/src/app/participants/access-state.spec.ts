import type { ParticipantAccountDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { ACCESS_STATE_FILTERS, describeAccessState } from './access-state';

const anAccount = (account: Partial<ParticipantAccountDto>): ParticipantAccountDto => ({
  onlyRole: 'game-master',
  state: 'no-link',
  accessLinkExpiresAt: null,
  accessLinkRemainingMinutes: null,
  ...account,
});

const MARCH_21 = { date: '2027-03-21', time: '09:30' };

describe('describeAccessState : le bandeau du compte (ID-16)', () => {
  it('Compte actif', () => {
    expect(describeAccessState(anAccount({ state: 'active' }))).toMatchObject({
      label: 'Compte actif',
      action: 'Créer un nouveau lien',
    });
  });

  it.each([
    [7 * 24 * 60, `En attente · encore 7${NBSP}jours`],
    [24 * 60 + 59, `En attente · encore 1${NBSP}jour`],
    [24 * 60 - 1, `En attente · encore 23${NBSP}h`],
    [60, `En attente · encore 1${NBSP}h`],
    [59, "En attente · encore moins d'une heure"],
  ])('En attente, avec le temps restant : %i minutes, « %s »', (minutes, label) => {
    expect(
      describeAccessState(
        anAccount({
          state: 'pending',
          accessLinkExpiresAt: MARCH_21,
          accessLinkRemainingMinutes: minutes,
        }),
      ),
    ).toMatchObject({ label, action: 'Créer un nouveau lien' });
  });

  it('Lien à créer', () => {
    expect(describeAccessState(anAccount({ state: 'no-link' }))).toMatchObject({
      label: 'Lien à créer',
      action: "Créer le lien d'accès",
    });
  });

  it('Lien expiré, avec sa date', () => {
    expect(
      describeAccessState(anAccount({ state: 'expired', accessLinkExpiresAt: MARCH_21 })),
    ).toMatchObject({
      label: `Lien expiré le dimanche 21 mars à 9${NBSP}h${NBSP}30`,
      action: 'Créer un nouveau lien',
    });
  });
});

describe('ACCESS_STATE_FILTERS : les filtres de la liste « Participants » (ID-16)', () => {
  it('un par état, dans l’ordre, avec son libellé court', () => {
    expect(ACCESS_STATE_FILTERS).toEqual([
      { state: 'active', label: 'Compte actif' },
      { state: 'pending', label: 'En attente' },
      { state: 'no-link', label: 'Lien à créer' },
      { state: 'expired', label: 'Lien expiré' },
    ]);
  });
});
