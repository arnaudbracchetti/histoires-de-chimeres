import { Account, ComparableName, Password } from '@chimeres/domain';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { AccountRepository } from './account-repository.js';
import type { AccountSessions } from './account-sessions.js';
import type { FirstOrganizerFingerprint } from './first-organizer-fingerprint.js';
import type { PasswordHasher } from './password-hasher.js';

/** La paire `ORGANIZER_PSEUDO` / `ORGANIZER_PASSWORD` de la configuration (ADR 0016). */
export type FirstOrganizer = { nickname: string; password: string };

/**
 * Au démarrage, donne au pseudo de la configuration un compte Organisateur avec ce mot de passe
 * (ADR 0016), une fois par valeur : l'empreinte de la valeur appliquée est gardée, et une valeur
 * inchangée ne touche plus au mot de passe choisi depuis. Le participant est créé s'il manque (ID-7) ;
 * le compte, s'il existait, devient Organisateur, change de mot de passe et perd ses sessions. Un
 * pseudo ou un mot de passe refusé lève le refus du domaine, avant toute écriture.
 */
export class InitializeFirstOrganizer {
  /** `newId` donne les identifiants, `computeFingerprint` l'empreinte d'une valeur. */
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: AccountSessions,
    private readonly fingerprint: FirstOrganizerFingerprint,
    private readonly newId: () => string,
    private readonly computeFingerprint: (organizer: FirstOrganizer) => string,
  ) {}

  async execute(organizer: FirstOrganizer): Promise<void> {
    const nickname = ComparableName.createFromText(organizer.nickname);
    const password = Password.createForNickname(organizer.password, nickname);
    const fingerprint = this.computeFingerprint(organizer);
    if ((await this.fingerprint.read()) === fingerprint) return;

    const { participantId } = await changeConvention(
      this.conventions,
      (convention) => {
        const existing = convention.participants.find((p) => p.nickname.equals(nickname));
        if (existing) return { participantId: existing.id, created: false };
        const participantId = this.newId();
        convention.addParticipant(participantId, organizer.nickname);
        return { participantId, created: true };
      },
      ({ created }) => created,
    );
    const account =
      (await this.accounts.findByParticipantId(participantId)) ??
      Account.createForParticipant(this.newId(), participantId);
    account.appointOrganizer();
    account.replacePasswordHash(await this.hasher.hash(password));
    await this.accounts.save(account);
    await this.sessions.closeAllOfAccount(account.id);
    await this.fingerprint.save(fingerprint);
  }
}
