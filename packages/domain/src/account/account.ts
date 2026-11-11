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

  replacePasswordHash(passwordHash: string): void {
    this.state = { ...this.state, passwordHash };
  }
}
