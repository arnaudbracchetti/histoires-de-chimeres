import type { ParticipantNicknameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Un Organisateur crée un pseudo de participant, pour une personne sans téléphone (ID-12). */
export class AddParticipant {
  /** `newId` donne l'identifiant du participant : le domaine ne génère rien. */
  constructor(
    private readonly repository: ConventionRepository,
    private readonly newId: () => string,
  ) {}

  /** L'identifiant du participant créé. */
  async execute({ nickname }: ParticipantNicknameBody): Promise<string> {
    const participantId = this.newId();
    await changeConvention(this.repository, (convention) =>
      convention.addParticipant(participantId, nickname),
    );
    return participantId;
  }
}
