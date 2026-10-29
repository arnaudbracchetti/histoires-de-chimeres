import type { LinkPhoneBody, LinkPhoneDto } from '@chimeres/contract';
import type { Clock } from '../clock.js';
import { changeConvention } from '../convention/change-convention.js';
import type { ConventionRepository } from '../convention/convention-repository.js';
import type { LinkedPhoneRepository } from './linked-phone-repository.js';

/** Le verdict, avec l'identifiant du téléphone relié : la valeur de son cookie. */
export type IdentifyResult =
  | (Extract<LinkPhoneDto, { status: 'linked' }> & { phoneId: string })
  | Extract<LinkPhoneDto, { status: 'confirmation-needed' }>;

/**
 * S'identifier par un pseudo (ID-1) : la convention rend son verdict, et n'est sauvegardée que si
 * elle a créé le participant. Un pseudo à relier l'est sous un nouvel identifiant de téléphone ;
 * si le téléphone était déjà relié, ce lien est coupé d'abord : un pseudo par téléphone (ID-8).
 */
export class Identify {
  /** `newParticipantId` et `newPhoneId` donnent les identifiants : le domaine ne génère rien. */
  constructor(
    private readonly conventions: ConventionRepository,
    private readonly phones: LinkedPhoneRepository,
    private readonly clock: Clock,
    private readonly newParticipantId: () => string,
    private readonly newPhoneId: () => string,
  ) {}

  /** `currentPhoneId` : le cookie du téléphone, s'il en a un. */
  async execute(
    { presenceCode, nickname, confirmation }: LinkPhoneBody,
    currentPhoneId: string | null,
  ): Promise<IdentifyResult> {
    const participantId = this.newParticipantId();
    const identification = await changeConvention(
      this.conventions,
      (convention) =>
        convention.identify(participantId, presenceCode, nickname, confirmation, this.clock.now()),
      (identification) => identification.verdict === 'link' && identification.created,
    );
    if (identification.verdict === 'confirm') {
      return {
        status: 'confirmation-needed',
        confirmation: identification.confirmation,
        nickname: identification.nickname,
      };
    }
    if (currentPhoneId) await this.phones.unlink(currentPhoneId);
    const phoneId = this.newPhoneId();
    await this.phones.link({ id: phoneId, participantId: identification.participant.id });
    return { status: 'linked', nickname: identification.participant.nickname.text, phoneId };
  }
}
