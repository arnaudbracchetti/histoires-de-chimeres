import { computed, effect, Injectable, signal } from '@angular/core';
import { gameMasterEndpoints, participantEndpoints } from '@chimeres/contract';
import { apiQueryResource, apiResource } from '../api-resource';

/**
 * PROTOTYPE JETABLE (#169, branche prototype/comptes) : les comptes, en mémoire. Les pseudos et
 * les MJ viennent de l'API ; les comptes, les rôles et les liens d'accès sont simulés, rien n'est
 * écrit. Recharger la page remet tout à zéro.
 */
export type Variant = 'A' | 'B' | 'C' | 'D';

export const VARIANTS: readonly { key: Variant; name: string }[] = [
  { key: 'A', name: 'Page « Comptes », tableau' },
  { key: 'B', name: 'Onglet « Compte » sur la fiche' },
  { key: 'C', name: 'Dialogue « Nouveau compte » + menu ⋯' },
  { key: 'D', name: 'Mixte : assistant + onglet « Compte »' },
];

/** Un pseudo, avec ce que le compte simulé en dit. Un compte existe dès qu'il a un rôle. */
export type Person = {
  id: string;
  nickname: string;
  gameMaster: boolean;
  organizer: boolean;
  /** La personne a choisi son mot de passe (par un lien d'accès, ou par la configuration). */
  passwordChosen: boolean;
  /** Le lien d'accès en cours, s'il y en a un, valable jusqu'à cette date. */
  link: { url: string; expiresAt: Date } | null;
  scenarios: number;
  games: number;
  /** L'Organisateur « connecté ». */
  me: boolean;
};

export const hasAccount = (person: Person) => person.gameMaster || person.organizer;

/** « MJ · Organisateur », « MJ », « Organisateur », « Participant ». */
export function rolesLabel(person: Person): string {
  const roles = [person.gameMaster && 'MJ', person.organizer && 'Organisateur'].filter(Boolean);
  return roles.length ? roles.join(' · ') : 'Participant';
}

/**
 * L'état du compte : actif (mot de passe choisi), en attente (lien remis, pas encore suivi),
 * lien expiré, sans lien (compte créé, aucun lien). `none` : pas de compte.
 */
export type AccessState = 'none' | 'active' | 'pending' | 'expired' | 'no-link';

export function accessState(person: Person): AccessState {
  if (!hasAccount(person)) return 'none';
  if (person.passwordChosen) return 'active';
  if (person.link) return person.link.expiresAt.getTime() < Date.now() ? 'expired' : 'pending';
  return 'no-link';
}

export const ACCESS_STATES: Record<
  Exclude<AccessState, 'none'>,
  { label: string; icon: string; color: string; help: string }
> = {
  active: {
    label: 'Compte actif',
    icon: 'circle-check',
    color: 'var(--success)',
    help: 'Le mot de passe est choisi : la personne se connecte seule.',
  },
  pending: {
    label: 'En attente',
    icon: 'hourglass',
    color: 'var(--accent)',
    help: 'Le lien d’accès est créé, la personne ne l’a pas encore suivi.',
  },
  expired: {
    label: 'Lien expiré',
    icon: 'octagon-alert',
    color: 'var(--danger)',
    help: 'Le lien n’a pas été suivi à temps : créez-en un nouveau.',
  },
  'no-link': {
    label: 'Lien à créer',
    icon: 'triangle-alert',
    color: 'var(--warning)',
    help: 'Le compte existe, mais aucun lien d’accès n’a été remis.',
  },
};

/** « Compte actif », « En attente · lien valable jusqu'au mercredi 18 novembre »… */
export function accessLabel(person: Person): string {
  const state = accessState(person);
  if (state === 'none') return '';
  if (state === 'pending') return `En attente · lien valable jusqu'au ${formatDay(person.link!.expiresAt)}`;
  if (state === 'expired') return `Lien expiré le ${formatDay(person.link!.expiresAt)}`;
  return ACCESS_STATES[state].label;
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const KEY = 'prototype-comptes';

function readVariant(): Variant {
  const param = new URLSearchParams(location.search).get('variante');
  if (param === 'A' || param === 'B' || param === 'C' || param === 'D') return param;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored === 'A' || stored === 'B' || stored === 'C' || stored === 'D') return stored;
  } catch {
    // Rien de gardé.
  }
  return 'A';
}

const comparable = (nickname: string) =>
  nickname
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

@Injectable({ providedIn: 'root' })
export class AccountsStore {
  readonly variant = signal<Variant>(readVariant());
  readonly variantName = computed(
    () => VARIANTS.find(({ key }) => key === this.variant())?.name ?? '',
  );

  private readonly participants = apiQueryResource(participantEndpoints.list, () => ({}));
  private readonly gameMasters = apiResource(gameMasterEndpoints.list);
  readonly people = signal<Person[]>([]);
  readonly ready = signal(false);
  private nextId = 0;

  constructor() {
    effect(() => {
      if (this.ready()) return;
      if (!this.participants.hasValue() || !this.gameMasters.hasValue()) return;
      const gameMasters = this.gameMasters.value() ?? [];
      let gameMasterRank = 0;
      const seeded: Person[] = (this.participants.value() ?? []).map((participant) => {
        const gameMaster = gameMasters.find(({ nickname }) => nickname === participant.nickname);
        const state = participant.gameMaster ? gameMasterRank++ % 4 : -1;
        return {
          id: participant.id,
          nickname: participant.nickname,
          gameMaster: participant.gameMaster,
          organizer: false,
          passwordChosen: participant.gameMaster && state === 0,
          link:
            participant.gameMaster && state === 1
              ? newLink()
              : participant.gameMaster && state === 3
                ? { ...newLink(), expiresAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) }
                : null,
          scenarios: gameMaster?.scenarios.length ?? 0,
          games: gameMaster ? new Set(gameMaster.games.map(({ gameId }) => gameId)).size : 0,
          me: false,
        };
      });
      seeded.unshift(
        this.blank('Aldric', { organizer: true, passwordChosen: true, me: true }),
        this.blank('Morgane', { organizer: true, gameMaster: true, passwordChosen: true, scenarios: 2 }),
      );
      this.people.set(seeded);
      this.ready.set(true);
    });
  }

  setVariant(variant: Variant): void {
    this.variant.set(variant);
    try {
      sessionStorage.setItem(KEY, variant);
    } catch {
      // Stockage refusé.
    }
  }

  byId(id: string): Person | undefined {
    return this.people().find((person) => person.id === id);
  }

  /** Le pseudo qui porte déjà ce nom (ID-7), s'il y en a un. */
  namesake(nickname: string): Person | undefined {
    const wanted = comparable(nickname);
    return wanted ? this.people().find((person) => comparable(person.nickname) === wanted) : undefined;
  }

  /**
   * Crée le compte d'un seul geste : le participant s'il n'existe pas (sinon le compte s'ajoute au
   * pseudo existant), le MJ si demandé, et le lien d'accès.
   */
  createAccount(nickname: string, roles: { gameMaster: boolean; organizer: boolean }): Person {
    const existing = this.namesake(nickname);
    const link = newLink();
    if (existing) {
      this.update(existing.id, {
        gameMaster: existing.gameMaster || roles.gameMaster,
        organizer: existing.organizer || roles.organizer,
        link,
        passwordChosen: false,
      });
      return this.byId(existing.id)!;
    }
    const person = this.blank(nickname.trim(), { ...roles, link });
    this.people.update((people) => [...people, person]);
    return person;
  }

  /** Remet le compte à zéro : nouveau lien, mot de passe effacé, sessions fermées. */
  createLink(id: string): Person {
    this.update(id, { link: newLink(), passwordChosen: false });
    return this.byId(id)!;
  }

  setRoles(id: string, roles: { gameMaster?: boolean; organizer?: boolean }): void {
    const changes: Partial<Person> = { ...roles };
    if (roles.gameMaster === false) Object.assign(changes, { scenarios: 0, games: 0 });
    this.update(id, changes);
    const person = this.byId(id)!;
    if (!hasAccount(person)) this.update(id, { link: null, passwordChosen: false });
  }

  /** Simule la personne qui suit son lien et choisit son mot de passe. */
  simulatePasswordChosen(id: string): void {
    this.update(id, { link: null, passwordChosen: true });
  }

  private update(id: string, changes: Partial<Person>): void {
    this.people.update((people) =>
      people.map((person) => (person.id === id ? { ...person, ...changes } : person)),
    );
  }

  private blank(nickname: string, fields: Partial<Person>): Person {
    return {
      id: `proto-${this.nextId++}`,
      nickname,
      gameMaster: false,
      organizer: false,
      passwordChosen: false,
      link: null,
      scenarios: 0,
      games: 0,
      me: false,
      ...fields,
    };
  }
}

function newLink(): { url: string; expiresAt: Date } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return {
    url: `${location.origin}/gestion/acces/${token}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  };
}
