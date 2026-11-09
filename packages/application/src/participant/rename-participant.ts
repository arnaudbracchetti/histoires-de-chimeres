import type { ParticipantNicknameBody } from '@chimeres/contract';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';

/** Un Organisateur renomme un pseudo, de participant ou de MJ (ID-13). */
export class RenameParticipant {
  constructor(private readonly repository: ConventionRepository) {}

  execute(participantId: string, { nickname }: ParticipantNicknameBody): Promise<void> {
    return changeConvention(this.repository, (convention) =>
      convention.renameParticipant(participantId, nickname),
    );
  }
}
