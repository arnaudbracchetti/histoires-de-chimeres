/**
 * PROTOTYPE, à jeter (#135). Données en mémoire et gestes simplifiés, pour juger les écrans des
 * pseudos. Aucune règle ici ne fait foi : le PRD (ID-5 à ID-14) reste la référence.
 */
import { computed, Injectable, signal } from '@angular/core';

export type SlotState = 'open' | 'provisional' | 'published' | 'ended';

export type Slot = { id: string; rank: number; start: string; end: string; state: SlotState };

export type Game = {
  id: string;
  slotId: string;
  /** Second créneau d'une partie double. */
  secondSlotId?: string;
  title: string;
  table: string;
  gameMasterId: string;
  maxSeats: number;
};

export type Phone = { linkedAt: string };

/** Résultat d'un pseudo dans le tirage d'un créneau. */
export type Result = { gameId: string } | 'unplaced';

export type Pseudo = {
  id: string;
  nickname: string;
  kind: 'participant' | 'gm';
  phones: Phone[];
  signUps: string[];
  results: Record<string, Result>;
  /** Créneaux où le pseudo est sans partie (IN-6). */
  withoutGame: string[];
};

export type Refusal = { message: string; pseudoId?: string };

const SLOTS: Slot[] = [
  { id: 's1', rank: 1, start: '09:30', end: '12:00', state: 'ended' },
  { id: 's2', rank: 2, start: '13:30', end: '16:00', state: 'published' },
  { id: 's3', rank: 3, start: '16:30', end: '19:00', state: 'provisional' },
  { id: 's4', rank: 4, start: '20:30', end: '23:00', state: 'open' },
  { id: 's5', rank: 5, start: '23:30', end: '02:00', state: 'open' },
];

const GAMES: Game[] = [
  { id: 'g1', slotId: 's1', title: 'La Tour d’ébène', table: 'Dragon', gameMasterId: 'p-kairos', maxSeats: 5 },
  { id: 'g2', slotId: 's1', title: 'Les Brumes d’Arkham', table: 'Licorne', gameMasterId: 'p-morgane', maxSeats: 4 },
  { id: 'g3', slotId: 's2', title: 'Le Bal des Masques', table: 'Dragon', gameMasterId: 'p-kairos', maxSeats: 7 },
  { id: 'g4', slotId: 's2', title: 'Station Héliade', table: 'Licorne', gameMasterId: 'p-morgane', maxSeats: 8 },
  { id: 'g5', slotId: 's2', title: 'Le Trône de Sel', table: 'Griffon', gameMasterId: 'p-tibo', maxSeats: 7 },
  { id: 'g6', slotId: 's3', title: 'Cendres de Vérone', table: 'Dragon', gameMasterId: 'p-tibo', maxSeats: 5 },
  { id: 'g7', slotId: 's3', title: 'L’Œil du Kraken', table: 'Licorne', gameMasterId: 'p-kairos', maxSeats: 4 },
  { id: 'g8', slotId: 's4', secondSlotId: 's5', title: 'La Nuit des Chimères', table: 'Dragon', gameMasterId: 'p-morgane', maxSeats: 6 },
  { id: 'g9', slotId: 's4', title: 'Neon Samouraï', table: 'Licorne', gameMasterId: 'p-kairos', maxSeats: 4 },
  { id: 'g10', slotId: 's4', title: 'Le Jardin d’Hiver', table: 'Griffon', gameMasterId: 'p-tibo', maxSeats: 5 },
  { id: 'g11', slotId: 's5', title: 'Minuit à Lisbonne', table: 'Licorne', gameMasterId: 'p-tibo', maxSeats: 4 },
];

function pseudo(
  id: string,
  nickname: string,
  extra: Partial<Omit<Pseudo, 'id' | 'nickname'>> = {},
): Pseudo {
  return {
    id,
    nickname,
    kind: 'participant',
    phones: [],
    signUps: [],
    results: {},
    withoutGame: [],
    ...extra,
  };
}

const PSEUDOS: Pseudo[] = [
  pseudo('p-kairos', 'Kaïros', { kind: 'gm', phones: [{ linkedAt: '08:52' }], signUps: ['g6'] }),
  pseudo('p-morgane', 'Morgane', { kind: 'gm', phones: [{ linkedAt: '09:05' }] }),
  pseudo('p-tibo', 'Tibo', { kind: 'gm' }),
  pseudo('p-elodie', 'Élodie', {
    phones: [{ linkedAt: '09:12' }, { linkedAt: '13:02' }],
    signUps: ['g1', 'g3', 'g4', 'g6', 'g8', 'g9'],
    results: { s1: { gameId: 'g1' }, s2: { gameId: 'g3' }, s3: { gameId: 'g6' } },
  }),
  pseudo('p-elodie2', 'elodie ', {
    phones: [{ linkedAt: '13:40' }],
    signUps: ['g10'],
  }),
  pseudo('p-mamie', 'Mamie Jo', {
    signUps: ['g2', 'g5'],
    results: { s1: { gameId: 'g2' }, s2: 'unplaced' },
  }),
  pseudo('p-lucas', 'Lucas', {
    phones: [{ linkedAt: '09:20' }],
    signUps: ['g1', 'g4', 'g7', 'g9'],
    results: { s1: { gameId: 'g1' }, s2: { gameId: 'g4' }, s3: 'unplaced' },
  }),
  pseudo('p-jeanluc', 'Jean-Luc', {
    phones: [{ linkedAt: '10:01' }],
    signUps: ['g3', 'g8'],
    results: { s2: { gameId: 'g3' } },
    withoutGame: ['s5'],
  }),
  pseudo('p-zoe', 'Zoé la Rouge', {
    phones: [{ linkedAt: '09:44' }],
    signUps: ['g2', 'g5', 'g7', 'g11'],
    results: { s1: { gameId: 'g2' }, s2: { gameId: 'g5' }, s3: { gameId: 'g7' } },
  }),
  pseudo('p-test', 'test orga', { phones: [{ linkedAt: 'veille, 21:10' }] }),
  ...[
    'Arthur', 'Bastien', 'Capucine', 'Dorian', 'Erwan', 'Fanny', 'Gaspard', 'Hélène', 'Inès',
    'Jules', 'Katell', 'Léon', 'Maëlle', 'Nolan', 'Océane', 'Pablo',
  ].map((name, index) => {
    const s1 = index % 2 ? 'g1' : 'g2';
    const s2 = ['g3', 'g4', 'g5'][index % 3];
    const s3 = index % 2 ? 'g6' : 'g7';
    const s4 = ['g8', 'g9', 'g10'][index % 3];
    return pseudo(`p-${index}`, name, {
      phones: index % 5 ? [{ linkedAt: `09:${String(10 + index).padStart(2, '0')}` }] : [],
      signUps: [s1, s2, s3, s4],
      results: {
        s1: { gameId: s1 },
        s2: index === 7 ? 'unplaced' : { gameId: s2 },
        s3: index === 3 ? 'unplaced' : { gameId: s3 },
      },
    });
  }),
];

/** ID-7 : casse, accents et espaces ne comptent pas ; la ponctuation compte. */
export function normalize(nickname: string): string {
  return nickname
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function slotLabel(slot: Slot): string {
  return `Créneau ${slot.rank}`;
}

export const STATE_LABELS: Record<SlotState, string> = {
  open: 'inscriptions ouvertes',
  provisional: 'tirage provisoire',
  published: 'tirage publié',
  ended: 'terminé',
};

/** Une ligne de la fiche : une partie du créneau, vue depuis un pseudo. */
export type GameLine = {
  game: Game;
  gameMaster: string;
  signedUp: number;
  players: number;
  veryRequested: boolean;
  remaining: number;
  mine: boolean;
  /** Le pseudo est MJ d'une partie de ce créneau : son inscription est de secours (IN-4). */
  backup: boolean;
  ownGame: boolean;
  double: boolean;
};

@Injectable({ providedIn: 'root' })
export class PrototypeStore {
  readonly slots = signal(SLOTS);
  readonly games = signal(GAMES);
  readonly pseudos = signal(PSEUDOS);

  readonly sorted = computed(() =>
    [...this.pseudos()].sort((a, b) => normalize(a.nickname).localeCompare(normalize(b.nickname))),
  );

  find(id: string | undefined): Pseudo | undefined {
    return this.pseudos().find((p) => p.id === id);
  }

  game(id: string): Game {
    return this.games().find((g) => g.id === id)!;
  }

  slot(id: string): Slot {
    return this.slots().find((s) => s.id === id)!;
  }

  nickname(id: string): string {
    return this.find(id)?.nickname ?? '?';
  }

  /** ID-5 : par une partie du nom (ID-7), ou par le titre d'une partie où le pseudo est inscrit. */
  search(query: string): { pseudo: Pseudo; byGame?: string }[] {
    const q = normalize(query);
    if (!q) return this.sorted().map((pseudo) => ({ pseudo }));
    return this.sorted().flatMap((pseudo) => {
      if (normalize(pseudo.nickname).includes(q)) return [{ pseudo }];
      const game = pseudo.signUps.map((id) => this.game(id)).find((g) => normalize(g.title).includes(q));
      return game ? [{ pseudo, byGame: game.title }] : [];
    });
  }

  taken(nickname: string, exceptId?: string): Pseudo | undefined {
    const key = normalize(nickname);
    return this.pseudos().find((p) => p.id !== exceptId && normalize(p.nickname) === key);
  }

  leadsOn(pseudoId: string, slotId: string): Game | undefined {
    return this.games().find(
      (g) => g.gameMasterId === pseudoId && (g.slotId === slotId || g.secondSlotId === slotId),
    );
  }

  /** Les parties d'un créneau, vues depuis un pseudo : inscrits, places, très demandée. */
  lines(pseudo: Pseudo, slotId: string): GameLine[] {
    const leads = this.leadsOn(pseudo.id, slotId);
    return this.games()
      .filter((g) => g.slotId === slotId)
      .map((game) => {
        const signedUp = this.pseudos().filter(
          (p) => p.signUps.includes(game.id) && !this.leadsOn(p.id, slotId),
        ).length;
        const players = this.pseudos().filter((p) => {
          const r = p.results[slotId];
          return r && r !== 'unplaced' && r.gameId === game.id;
        }).length;
        return {
          game,
          gameMaster: this.nickname(game.gameMasterId),
          signedUp,
          players,
          veryRequested: signedUp > game.maxSeats,
          remaining: Math.max(0, game.maxSeats - players),
          mine: pseudo.signUps.includes(game.id),
          backup: !!leads,
          ownGame: game.gameMasterId === pseudo.id,
          double: !!game.secondSlotId,
        };
      });
  }

  /** Ce que le pseudo a sur chaque créneau, pour la liste. */
  summary(pseudo: Pseudo, slot: Slot): { label: string; tone: 'placed' | 'unplaced' | 'signed' | 'none' | 'leads' } {
    const leads = this.leadsOn(pseudo.id, slot.id);
    if (leads) return { label: `mène ${leads.title}`, tone: 'leads' };
    const result = pseudo.results[slot.id];
    if (result === 'unplaced') return { label: 'non placé', tone: 'unplaced' };
    if (result) return { label: this.game(result.gameId).title, tone: 'placed' };
    if (pseudo.withoutGame.includes(slot.id)) return { label: 'sans partie', tone: 'unplaced' };
    const n = pseudo.signUps.filter((id) => this.game(id).slotId === slot.id).length;
    if (n) return { label: n === 1 ? '1 inscription' : `${n} inscriptions`, tone: 'signed' };
    return { label: '—', tone: 'none' };
  }

  // ————— Gestes (en mémoire) —————

  private patch(id: string, change: (p: Pseudo) => Pseudo): void {
    this.pseudos.update((all) => all.map((p) => (p.id === id ? change(p) : p)));
  }

  create(nickname: string): Pseudo | Refusal {
    const name = nickname.trim();
    if (!name) return { message: 'Saisis un pseudo.' };
    const other = this.taken(name);
    if (other)
      return { message: `« ${other.nickname} » existe déjà.`, pseudoId: other.id };
    const created = pseudo(`p-new-${Date.now()}`, name);
    this.pseudos.update((all) => [...all, created]);
    return created;
  }

  rename(id: string, nickname: string): Refusal | undefined {
    const name = nickname.trim();
    if (!name) return { message: 'Saisis un pseudo.' };
    const other = this.taken(name, id);
    if (other) return { message: `« ${other.nickname} » est déjà pris.`, pseudoId: other.id };
    this.patch(id, (p) => ({ ...p, nickname: name }));
    return undefined;
  }

  cutLinks(id: string): void {
    this.patch(id, (p) => ({ ...p, phones: [] }));
  }

  remove(id: string): void {
    this.pseudos.update((all) => all.filter((p) => p.id !== id));
  }

  signUp(id: string, gameId: string): Refusal | undefined {
    const game = this.game(gameId);
    if (this.slot(game.slotId).state !== 'open')
      return { message: 'Les inscriptions de ce créneau sont fermées.' };
    if (game.gameMasterId === id) return { message: 'Un MJ ne s’inscrit pas à sa propre partie.' };
    this.patch(id, (p) => ({
      ...p,
      signUps: p.signUps.includes(gameId) ? p.signUps : [...p.signUps, gameId],
      withoutGame: p.withoutGame.filter((s) => s !== game.slotId),
    }));
    return undefined;
  }

  signOff(id: string, gameId: string): void {
    this.patch(id, (p) => ({ ...p, signUps: p.signUps.filter((g) => g !== gameId) }));
  }

  withdraw(id: string, slotId: string): void {
    this.patch(id, (p) => ({ ...p, withoutGame: p.withoutGame.filter((s) => s !== slotId) }));
  }

  /** ID-14 : refus si déjà dans le tirage ou MJ qui mène sur ce créneau. */
  addLatecomer(id: string, slotId: string): Refusal | undefined {
    const p = this.find(id)!;
    if (p.results[slotId]) return { message: `« ${p.nickname} » est déjà dans ce tirage.` };
    if (this.leadsOn(id, slotId)) return { message: `« ${p.nickname} » mène une partie sur ce créneau.` };
    this.patch(id, (q) => ({ ...q, results: { ...q.results, [slotId]: 'unplaced' } }));
    return undefined;
  }

  /** TI-6 : le tirage provisoire est effacé, les inscriptions du créneau rouvertes. */
  reopen(slotId: string): void {
    this.slots.update((all) => all.map((s) => (s.id === slotId ? { ...s, state: 'open' as const } : s)));
    this.pseudos.update((all) =>
      all.map((p) => {
        const { [slotId]: _, ...results } = p.results;
        return { ...p, results };
      }),
    );
  }

  /** Tables où il reste de la place, pour un créneau publié. */
  remaining(slotId: string): { table: string; title: string; remaining: number }[] {
    const anyone = this.pseudos()[0];
    return this.lines(anyone, slotId)
      .filter((l) => l.remaining > 0)
      .map((l) => ({ table: l.game.table, title: l.game.title, remaining: l.remaining }));
  }

  /** ID-11, très simplifié : ce que la fusion ferait, créneau par créneau. */
  mergeConsequences(sourceId: string, targetId: string): string[] {
    const source = this.find(sourceId)!;
    const target = this.find(targetId)!;
    const lines: string[] = [];
    for (const slot of this.slots()) {
      const s = source.results[slot.id];
      const t = target.results[slot.id];
      const sSign = source.signUps.filter((g) => this.game(g).slotId === slot.id);
      if (!s && !sSign.length) continue;
      if (t && t !== 'unplaced' && s)
        lines.push(`${slotLabel(slot)} : « ${target.nickname} » est déjà placé, le résultat de « ${source.nickname} » est perdu.`);
      else if (s && s !== 'unplaced' && t === 'unplaced')
        lines.push(`${slotLabel(slot)} : « ${target.nickname} » prend la place de « ${source.nickname} » à ${this.game(s.gameId).title}.`);
      else if (this.leadsOn(targetId, slot.id))
        lines.push(`${slotLabel(slot)} : « ${target.nickname} » y mène une partie, les inscriptions passent en secours.`);
      else if (sSign.length || s)
        lines.push(`${slotLabel(slot)} : ses inscriptions${s ? ' et son résultat' : ''} passent sur « ${target.nickname} ».`);
    }
    if (source.phones.length)
      lines.push(`Ses ${source.phones.length} téléphone(s) relié(s) seront coupés, pas transférés.`);
    lines.push(`« ${source.nickname} » sera supprimé.`);
    return lines;
  }

  merge(sourceId: string, targetId: string): void {
    const source = this.find(sourceId)!;
    this.patch(targetId, (t) => {
      const results = { ...t.results };
      for (const [slotId, r] of Object.entries(source.results)) {
        if (!results[slotId] || results[slotId] === 'unplaced') results[slotId] = r;
      }
      return {
        ...t,
        signUps: [...new Set([...t.signUps, ...source.signUps])].filter(
          (g) => this.game(g).gameMasterId !== targetId,
        ),
        results,
      };
    });
    this.remove(sourceId);
  }

  /** Ce que la suppression emporte (ID-10). */
  removeConsequences(id: string): string[] {
    const p = this.find(id)!;
    const out: string[] = [];
    if (p.signUps.length) out.push(`Ses ${p.signUps.length} inscriptions seront supprimées.`);
    const results = Object.keys(p.results).length;
    if (results) out.push(`Il sort de ${results} tirage(s), publiés compris : sa partie comptera un joueur de moins.`);
    if (p.phones.length) out.push(`Ses ${p.phones.length} téléphone(s) relié(s) seront coupés.`);
    out.push('Le pseudo redeviendra libre.');
    return out;
  }
}
