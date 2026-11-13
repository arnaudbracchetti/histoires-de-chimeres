import type { ParticipantSheetDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { roleWithdrawalConsequences } from './role-withdrawal-consequences';

const aSheet = (sheet: Partial<ParticipantSheetDto>): ParticipantSheetDto => ({
  id: 'p1',
  nickname: 'Lune',
  gameMaster: false,
  organizer: false,
  account: null,
  signedUpGameIds: [],
  backupGameIds: [],
  timeSlots: [],
  linkedPhones: [],
  ...sheet,
});

const ACCOUNT_REMOVED = `Sans autre rôle, son compte sera supprimé, avec son mot de passe, son lien d'accès et ses sessions. «${NBSP}Lune${NBSP}» reste un participant, avec ses inscriptions et ses téléphones.`;

describe('roleWithdrawalConsequences (ID-16)', () => {
  it('dit que les disponibilités du MJ partent, et son compte avec son dernier rôle', () => {
    expect(
      roleWithdrawalConsequences(
        aSheet({
          gameMaster: true,
          account: { onlyRole: 'game-master', state: 'no-link', accessLinkExpiresAt: null },
        }),
        'game-master',
      ),
    ).toEqual(['Ses disponibilités seront supprimées.', ACCOUNT_REMOVED]);
  });

  it("garde le compte d'un MJ qui reste Organisateur", () => {
    expect(
      roleWithdrawalConsequences(
        aSheet({
          gameMaster: true,
          organizer: true,
          account: { onlyRole: null, state: 'no-link', accessLinkExpiresAt: null },
        }),
        'game-master',
      ),
    ).toEqual(['Ses disponibilités seront supprimées.']);
  });

  it('dit ce qui reste à un Organisateur qui reste MJ', () => {
    expect(
      roleWithdrawalConsequences(
        aSheet({
          gameMaster: true,
          organizer: true,
          account: { onlyRole: null, state: 'no-link', accessLinkExpiresAt: null },
        }),
        'organizer',
      ),
    ).toEqual([
      `«${NBSP}Lune${NBSP}» reste MJ${NBSP}: son compte ne donnera plus accès qu'à sa fiche et aux scénarios de la convention.`,
    ]);
  });

  it("supprime le compte d'un Organisateur sans autre rôle", () => {
    expect(
      roleWithdrawalConsequences(
        aSheet({
          organizer: true,
          account: { onlyRole: 'organizer', state: 'no-link', accessLinkExpiresAt: null },
        }),
        'organizer',
      ),
    ).toEqual([ACCOUNT_REMOVED]);
  });

  it("ne parle pas de compte pour un MJ qui n'en a pas", () => {
    expect(roleWithdrawalConsequences(aSheet({ gameMaster: true }), 'game-master')).toEqual([
      'Ses disponibilités seront supprimées.',
    ]);
  });
});
