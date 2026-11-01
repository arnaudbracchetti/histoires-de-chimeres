import { ComparableName } from '../comparable-name.js';
import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { Identification, IdentityConfirmation, WithdrawalVerdict } from './convention.js';
import type { Day } from './day.js';
import { GameMaster } from './game-master.js';
import { Participant } from './participant.js';
import type { Schedule } from './schedule.js';
import { UniquelyNamedCollection, type NamingRules } from './uniquely-named-collection.js';

/**
 * Ce que les règles des disponibilités lisent hors des participants : la Journée, pour vérifier un
 * créneau et en donner le rang, et le Programme, pour savoir où le MJ mène (PR-15).
 */
export type AvailabilityCollaborators = { day: Day; schedule: Schedule };

/**
 * Participants : ceux de la convention, MJ compris. Un MJ est un participant qui en a le rôle : un
 * seul ensemble de pseudos, celui des participants (ADR 0012). Ils gardent l'identification (ID-1,
 * ID-3, ID-4, ID-7), le pseudo des MJ (PR-12) et leurs disponibilités (PR-2, PR-15). Immuables :
 * chaque geste rend d'autres participants. La Journée et le Programme leur sont passés à chaque
 * appel : c'est la convention qui les détient.
 */
export class Participants {
  /** Reprise par `Convention.NICKNAME_MAX_LENGTH`. */
  static readonly NICKNAME_MAX_LENGTH = 30;

  /**
   * `allGameMasters` désigne des participants de `allParticipants` : chaque geste les tient d'accord.
   */
  private constructor(
    private readonly allParticipants: UniquelyNamedCollection<Participant>,
    private readonly allGameMasters: UniquelyNamedCollection<GameMaster>,
  ) {}

  /**
   * `participants` et `gameMasters`, dans n'importe quel ordre. Ceux des MJ peuvent manquer à
   * `participants` : chaque MJ apporte le sien.
   */
  static createFromParticipantsAndGameMasters(
    participants: Iterable<Participant>,
    gameMasters: Iterable<GameMaster>,
  ): Participants {
    const allGameMasters = [...gameMasters];
    return new Participants(
      UniquelyNamedCollection.createFromItems(
        new Map(
          [...participants, ...allGameMasters.map((gameMaster) => gameMaster.participant)].map(
            (participant) => [participant.id, participant],
          ),
        ).values(),
        PARTICIPANT_NICKNAME_RULES,
      ),
      UniquelyNamedCollection.createFromItems(allGameMasters, GAME_MASTER_NICKNAME_RULES),
    );
  }

  /** Les participants, MJ compris, dans l'ordre naturel de leur pseudo. */
  get participants(): readonly Participant[] {
    return this.allParticipants.itemsInNaturalOrder;
  }

  /** Les MJ, dans l'ordre naturel de leur pseudo. */
  get gameMasters(): readonly GameMaster[] {
    return this.allGameMasters.itemsInNaturalOrder;
  }

  findExistingParticipantById(id: string): Participant {
    return this.allParticipants.findExistingItemById(id);
  }

  findExistingGameMasterById(id: string): GameMaster {
    return this.allGameMasters.findExistingItemById(id);
  }

  verifyGameMasterExists(id: string): void {
    this.allGameMasters.verifyItemExists(id);
  }

  /** Le MJ du participant, ou `undefined` s'il n'en a pas le rôle (ADR 0012). */
  findGameMasterOfParticipant(participantId: string): GameMaster | undefined {
    return this.allGameMasters.itemsInNaturalOrder.find(
      (gameMaster) => gameMaster.participant.id === participantId,
    );
  }

  /** Nombre de MJ disponibles sur le créneau. */
  countAvailabilitiesOnTimeSlot(timeSlotId: string): number {
    return this.allGameMasters.itemsInNaturalOrder.filter((gameMaster) =>
      gameMaster.isAvailableOnTimeSlot(timeSlotId),
    ).length;
  }

  /**
   * Le verdict d'une identification par ce pseudo (ID-1). Un pseudo nouveau donne un participant à
   * créer, sous l'identifiant `newParticipantId`, et à relier. Un pseudo existant, comparé selon ID-7,
   * demande d'abord une confirmation, celle d'un MJ si c'est le sien (ID-3), et n'est donné à relier
   * qu'avec elle. Le pseudo d'un MJ est celui de son participant : il n'en devient jamais un autre
   * (ID-4). Rien ne change : le participant à créer s'ajoute par `getParticipantsAfterAddingParticipant()`.
   */
  computeIdentification(
    newParticipantId: string,
    nickname: string,
    confirmation: IdentityConfirmation | null,
  ): Identification {
    const typed = ComparableName.createFromText(nickname);
    const existing = this.allParticipants.findItemWithSameName(typed);
    if (!existing) {
      return {
        verdict: 'link',
        created: true,
        participant: new Participant(newParticipantId, typed),
      };
    }
    const expected = this.hasGameMasterRole(existing) ? 'game-master' : 'participant';
    if (confirmation !== expected) {
      return { verdict: 'confirm', confirmation: expected, nickname: existing.nickname.text };
    }
    return { verdict: 'link', created: false, participant: existing };
  }

  /** Les participants après l'ajout de celui-ci, au pseudo obligatoire, borné et libre (ID-1, ID-7). */
  getParticipantsAfterAddingParticipant(participant: Participant): Participants {
    return new Participants(
      this.allParticipants.getCollectionAfterAddingItem(participant),
      this.allGameMasters,
    );
  }

  /**
   * Les participants après l'ajout d'un MJ, avec son participant (`participantId`), au pseudo
   * obligatoire, borné et unique, parmi les MJ comme parmi les participants (PR-12, ID-4, ID-7). Le
   * pseudo est vérifié d'abord parmi les MJ : un autre MJ donne son motif au refus.
   */
  getParticipantsAfterAddingGameMaster(
    id: string,
    participantId: string,
    nickname: string,
  ): Participants {
    const gameMaster = new GameMaster(
      id,
      new Participant(participantId, ComparableName.createFromText(nickname)),
    );
    const gameMasters = this.allGameMasters.getCollectionAfterAddingItem(gameMaster);
    return new Participants(
      this.allParticipants.getCollectionAfterAddingItem(gameMaster.participant),
      gameMasters,
    );
  }

  /**
   * Les participants après le changement de pseudo d'un MJ, aux mêmes règles qu'à sa création :
   * celui de son participant, qui garde son identifiant (PR-12).
   */
  getParticipantsAfterChangingGameMasterNickname(id: string, nickname: string): Participants {
    const renamed = this.allGameMasters
      .findExistingItemById(id)
      .getGameMasterAfterChangingNickname(ComparableName.createFromText(nickname));
    const gameMasters = this.allGameMasters.getCollectionAfterReplacingItem(renamed);
    return new Participants(
      this.allParticipants.getCollectionAfterReplacingItem(renamed.participant),
      gameMasters,
    );
  }

  /**
   * Les participants sans le MJ, ni ses disponibilités, ni son participant. Un MJ qui a au moins un
   * scénario reste (PR-12) : le catalogue, entier, le dit.
   */
  getParticipantsAfterRemovingGameMaster(id: string, catalogue: ScenarioCatalogue): Participants {
    const gameMaster = this.allGameMasters.findExistingItemById(id);
    const scenarios = catalogue.countScenariosOfGameMaster(id);
    if (scenarios > 0) throw new Refusal('game-master-has-scenarios', { scenarios });
    return new Participants(
      this.allParticipants.getCollectionAfterRemovingItem(gameMaster.participant.id),
      this.allGameMasters.getCollectionAfterRemovingItem(id),
    );
  }

  /** Le MJ se déclare disponible sur un créneau existant (PR-2). Déclarer deux fois ne change rien. */
  getParticipantsAfterDeclaringAvailability(
    gameMasterId: string,
    timeSlotId: string,
    day: Day,
  ): Participants {
    const gameMaster = this.allGameMasters.findExistingItemById(gameMasterId);
    day.verifyTimeSlotExists(timeSlotId);
    return new Participants(
      this.allParticipants,
      this.allGameMasters.getCollectionAfterReplacingItem(
        gameMaster.getGameMasterAfterDeclaringAvailability(timeSlotId),
      ),
    );
  }

  /**
   * Le MJ retire sa disponibilité sur un créneau existant, sauf s'il y mène une partie (PR-15).
   * Retirer une absente ne change rien.
   */
  getParticipantsAfterWithdrawingAvailability(
    gameMasterId: string,
    timeSlotId: string,
    collaborators: AvailabilityCollaborators,
  ): Participants {
    const gameMaster = this.allGameMasters.findExistingItemById(gameMasterId);
    collaborators.day.verifyTimeSlotExists(timeSlotId);
    const refusal = findWithdrawalRefusal(gameMaster, timeSlotId, collaborators);
    if (refusal) throw refusal;
    return new Participants(
      this.allParticipants,
      this.allGameMasters.getCollectionAfterReplacingItem(
        gameMaster.getGameMasterAfterWithdrawingAvailability(timeSlotId),
      ),
    );
  }

  /**
   * Le verdict de retrait de chaque disponibilité du MJ, dans l'ordre de la journée : le refus que
   * `getParticipantsAfterWithdrawingAvailability()` y lèverait, ou `null`.
   */
  computeWithdrawalVerdicts(
    gameMasterId: string,
    collaborators: AvailabilityCollaborators,
  ): WithdrawalVerdict[] {
    const gameMaster = this.allGameMasters.findExistingItemById(gameMasterId);
    return collaborators.day.timeSlots
      .filter((slot) => gameMaster.isAvailableOnTimeSlot(slot.id))
      .map((slot) => ({
        timeSlotId: slot.id,
        refusal: findWithdrawalRefusal(gameMaster, slot.id, collaborators),
      }));
  }

  /** Les participants après le retrait des disponibilités de chaque MJ sur ce créneau (PR-10). */
  getParticipantsAfterWithdrawingAvailabilitiesOnTimeSlot(timeSlotId: string): Participants {
    return new Participants(
      this.allParticipants,
      this.allGameMasters.getCollectionAfterReplacingEachItem((gameMaster) =>
        gameMaster.getGameMasterAfterWithdrawingAvailability(timeSlotId),
      ),
    );
  }

  /** Le participant a un rôle de MJ (ADR 0012). */
  private hasGameMasterRole(participant: Participant): boolean {
    return this.findGameMasterOfParticipant(participant.id) !== undefined;
  }
}

/** La règle PR-15 du retrait d'une disponibilité, la même pour l'écriture et pour le verdict. */
function findWithdrawalRefusal(
  gameMaster: GameMaster,
  timeSlotId: string,
  { day, schedule }: AvailabilityCollaborators,
): Refusal | null {
  if (!schedule.isGameMasterLeadingOnTimeSlot(gameMaster.id, timeSlotId)) return null;
  return new Refusal('availability-has-game', {
    nickname: gameMaster.nickname.text,
    rank: day.getTimeSlotRank(timeSlotId),
  });
}

/**
 * Le pseudo d'un MJ : obligatoire, borné, unique parmi les MJ (PR-12, ID-7). Vérifié avant celui de
 * son participant, il donne son motif au refus d'un pseudo de MJ.
 */
const GAME_MASTER_NICKNAME_RULES: NamingRules<GameMaster> = {
  getName: (gameMaster) => gameMaster.nickname,
  maxLength: Participants.NICKNAME_MAX_LENGTH,
  refuseMissingItem: () => new Refusal('game-master-not-found', {}),
  refuseEmptyName: () => new Refusal('nickname-required', {}),
  refuseTooLongName: (max) => new Refusal('nickname-too-long', { max }),
  refuseTakenName: (namesake) =>
    new Refusal('nickname-taken', { nickname: namesake.nickname.text }),
};

/**
 * Le pseudo d'un participant, MJ compris : obligatoire, borné, unique parmi les participants (ID-1,
 * ID-4, ID-7). `computeIdentification()` relie un pseudo déjà pris au lieu de le refuser ; seuls
 * l'ajout et le renommage d'un MJ le refusent, une fois écarté un autre MJ (PR-12).
 */
const PARTICIPANT_NICKNAME_RULES: NamingRules<Participant> = {
  getName: (participant) => participant.nickname,
  maxLength: Participants.NICKNAME_MAX_LENGTH,
  refuseMissingItem: () => new Refusal('participant-not-found', {}),
  refuseEmptyName: () => new Refusal('nickname-required', {}),
  refuseTooLongName: (max) => new Refusal('nickname-too-long', { max }),
  refuseTakenName: (namesake) =>
    new Refusal('nickname-taken-by-participant', { nickname: namesake.nickname.text }),
};
