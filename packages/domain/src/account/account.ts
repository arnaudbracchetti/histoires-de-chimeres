import type { Convention } from '../convention/convention.js';
import { Refusal } from '../refusal.js';

/** Un rôle du back office (ID-16) : Organisateur, porté par le compte, ou MJ, porté par le participant. */
export type AccountRole = 'organizer' | 'game-master';

export type AccountState = {
  id: string;
  /** Le participant de la personne : son pseudo sert d'identifiant de connexion (ADR 0015). */
  participantId: string;
  organizer: boolean;
  /** Le hachage du mot de passe, ou `null` tant qu'aucun n'est choisi. */
  passwordHash: string | null;
};

/**
 * Compte : ce qui fait entrer un MJ ou un Organisateur dans le back office (ADR 0015). Agrégat à
 * part de la convention : la connexion cherche un compte par pseudo sans charger la convention.
 * Être MJ se lit sur le participant (ADR 0012) : le compte ne porte que l'indicateur Organisateur.
 * Il reçoit un hachage déjà calculé, d'un `Password` vérifié.
 */
export class Account {
  private constructor(private state: AccountState) {}

  static restore(state: AccountState): Account {
    return new Account({ ...state });
  }

  /** Un compte neuf pour ce participant, ni Organisateur, ni mot de passe. */
  static createForParticipant(id: string, participantId: string): Account {
    return new Account({ id, participantId, organizer: false, passwordHash: null });
  }

  get id(): string {
    return this.state.id;
  }

  get participantId(): string {
    return this.state.participantId;
  }

  get isOrganizer(): boolean {
    return this.state.organizer;
  }

  get passwordHash(): string | null {
    return this.state.passwordHash;
  }

  appointOrganizer(): void {
    this.state = { ...this.state, organizer: true };
  }

  /**
   * Retire le rôle d'Organisateur, à la demande du compte `actingAccount` (ID-16). Un Organisateur
   * ne se le retire pas lui-même : il reste ainsi toujours au moins un Organisateur. Il le peut pour
   * un autre Organisateur.
   */
  withdrawOrganizerRole(actingAccount: Account): void {
    if (actingAccount.id === this.id) throw new Refusal('own-organizer-role-withdrawal', {});
    this.state = { ...this.state, organizer: false };
  }

  /**
   * Le compte n'a plus de rôle : ni Organisateur, ni MJ sur la convention (ID-16). Il doit alors
   * disparaître.
   */
  isWithoutRole(convention: Convention): boolean {
    return !this.isOrganizer && !convention.isParticipantGameMaster(this.participantId);
  }

  /**
   * Le seul rôle du compte, dont le retrait le supprimerait (ID-16), ou `null` s'il en a deux.
   */
  findOnlyRole(convention: Convention): AccountRole | null {
    const gameMaster = convention.isParticipantGameMaster(this.participantId);
    if (this.isOrganizer === gameMaster) return null;
    return this.isOrganizer ? 'organizer' : 'game-master';
  }

  replacePasswordHash(passwordHash: string): void {
    this.state = { ...this.state, passwordHash };
  }
}
