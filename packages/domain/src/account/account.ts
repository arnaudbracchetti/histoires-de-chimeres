import type { Convention } from '../convention/convention.js';
import { isReachedAt, type LocalMoment } from '../convention/local-moment.js';
import { Refusal } from '../refusal.js';

/** Un rôle du back office (ID-16) : Organisateur, porté par le compte, ou MJ, porté par le participant. */
export type AccountRole = 'organizer' | 'game-master';

/**
 * L'état d'un compte, sur l'onglet « Compte » (ID-16) : mot de passe choisi (`active`), lien
 * d'accès en cours (`pending`), lien expiré sans mot de passe (`expired`), ni l'un ni l'autre
 * (`no-link`).
 */
export type AccessState = 'active' | 'pending' | 'expired' | 'no-link';

/**
 * Le lien d'accès en cours du compte (ADR 0018) : l'empreinte de son jeton, jamais le jeton, sa fin
 * de validité, et s'il a déjà servi. Il reste après usage, pour dire « déjà utilisé ».
 */
export type AccessLink = { tokenHash: string; expiresAt: LocalMoment; used: boolean };

export type AccountState = {
  id: string;
  /** Le participant de la personne : son pseudo sert d'identifiant de connexion (ADR 0015). */
  participantId: string;
  organizer: boolean;
  /** Le hachage du mot de passe, ou `null` tant qu'aucun n'est choisi. */
  passwordHash: string | null;
  /** Le dernier lien d'accès créé, ou `null` si aucun ne l'a été. */
  accessLink: AccessLink | null;
};

/**
 * Compte : ce qui fait entrer un MJ ou un Organisateur dans le back office (ADR 0015). Agrégat à
 * part de la convention : la connexion cherche un compte par pseudo sans charger la convention.
 * Être MJ se lit sur le participant (ADR 0012) : le compte ne porte que l'indicateur Organisateur.
 * Il reçoit un hachage déjà calculé, d'un `Password` vérifié.
 */
export class Account {
  /** Un lien d'accès vaut 7 jours (ADR 0018). */
  static readonly ACCESS_LINK_DAYS = 7;

  private constructor(private state: AccountState) {}

  static restore(state: AccountState): Account {
    return new Account({ ...state });
  }

  /** Un compte neuf pour ce participant, ni Organisateur, ni mot de passe. */
  static createForParticipant(id: string, participantId: string): Account {
    return new Account({
      id,
      participantId,
      organizer: false,
      passwordHash: null,
      accessLink: null,
    });
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

  get accessLinkTokenHash(): string | null {
    return this.state.accessLink?.tokenHash ?? null;
  }

  get accessLinkExpiresAt(): LocalMoment | null {
    return this.state.accessLink?.expiresAt ?? null;
  }

  get isAccessLinkUsed(): boolean {
    return this.state.accessLink?.used ?? false;
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

  /**
   * Crée un lien d'accès, valable 7 jours à partir de `now` (ADR 0018), qui remplace le précédent.
   * Il remet le compte à zéro : le mot de passe est effacé ; la commande ferme les sessions. Rend
   * la fin de validité du lien.
   */
  createAccessLink(tokenHash: string, now: LocalMoment): LocalMoment {
    const expiresAt = { date: addDays(now.date, Account.ACCESS_LINK_DAYS), time: now.time };
    this.state = {
      ...this.state,
      passwordHash: null,
      accessLink: { tokenHash, expiresAt, used: false },
    };
    return expiresAt;
  }

  /**
   * Le lien d'accès peut encore servir à `now` : refuse un lien déjà utilisé, puis un lien expiré.
   * Un compte sans lien n'est jamais trouvé par un jeton : c'est la commande qui dit « inconnu ».
   */
  verifyAccessLinkUsable(now: LocalMoment): void {
    const link = this.state.accessLink;
    if (!link) throw new Refusal('access-link-unknown', {});
    if (link.used) throw new Refusal('access-link-used', {});
    if (isReachedAt(link.expiresAt, now)) throw new Refusal('access-link-expired', {});
  }

  /** Utilise le lien d'accès pour choisir le mot de passe, déjà haché : il ne servira plus. */
  useAccessLink(passwordHash: string, now: LocalMoment): void {
    this.verifyAccessLinkUsable(now);
    this.state = {
      ...this.state,
      passwordHash,
      accessLink: { ...this.state.accessLink!, used: true },
    };
  }

  /** L'état du compte à `now`, pour l'onglet « Compte » (ID-16). */
  computeAccessState(now: LocalMoment): AccessState {
    if (this.passwordHash !== null) return 'active';
    const link = this.state.accessLink;
    if (!link || link.used) return 'no-link';
    return isReachedAt(link.expiresAt, now) ? 'expired' : 'pending';
  }
}

/** La date `AAAA-MM-JJ`, `days` jours plus tard. */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
