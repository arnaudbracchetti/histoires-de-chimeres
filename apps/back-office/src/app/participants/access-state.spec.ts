import type { ParticipantAccountDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { describeAccessState } from './access-state';

const anAccount = (account: Partial<ParticipantAccountDto>): ParticipantAccountDto => ({
  onlyRole: 'game-master',
  state: 'no-link',
  accessLinkExpiresAt: null,
  ...account,
});

const MARCH_21 = { date: '2027-03-21', time: '09:30' };

describe('describeAccessState : le bandeau du compte (ID-16)', () => {
  it('Compte actif, en vert', () => {
    expect(describeAccessState(anAccount({ state: 'active' }))).toMatchObject({
      label: 'Compte actif',
      color: 'var(--success)',
      action: 'Créer un nouveau lien',
    });
  });

  it('En attente, en orange, avec la fin du lien', () => {
    expect(
      describeAccessState(anAccount({ state: 'pending', accessLinkExpiresAt: MARCH_21 })),
    ).toMatchObject({
      label: `En attente · lien valable jusqu'au dimanche 21 mars à 9${NBSP}h${NBSP}30`,
      color: 'var(--accent)',
      action: 'Créer un nouveau lien',
    });
  });

  it('Lien à créer, en jaune', () => {
    expect(describeAccessState(anAccount({ state: 'no-link' }))).toMatchObject({
      label: 'Lien à créer',
      color: 'var(--warning)',
      action: "Créer le lien d'accès",
    });
  });

  it('Lien expiré, en rouge, avec sa date', () => {
    expect(
      describeAccessState(anAccount({ state: 'expired', accessLinkExpiresAt: MARCH_21 })),
    ).toMatchObject({
      label: `Lien expiré le dimanche 21 mars à 9${NBSP}h${NBSP}30`,
      color: 'var(--danger)',
      action: 'Créer un nouveau lien',
    });
  });
});
