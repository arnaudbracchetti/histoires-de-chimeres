import { computed, inject, Injectable, signal } from '@angular/core';
import { gameMasterEndpoints } from '@chimeres/contract';
import { apiResource, currentValue } from '../api-resource';

/**
 * PROTOTYPE JETABLE (#171, branche prototype/espace-mj) : quelle variante de l'espace du MJ, quel
 * rôle simulé, quel MJ « connecté ». Rien n'est vérifié : il n'y a pas encore de session.
 * Lu une fois dans l'URL (`?variante=A&role=mj&mj=<id>`), gardé ensuite dans sessionStorage.
 */
export type Variant = 'A' | 'B' | 'C';
export type Role = 'mj' | 'mj-orga' | 'off';

export const VARIANTS: readonly { key: Variant; name: string }[] = [
  { key: 'A', name: 'Rail réduit, la fiche pour accueil' },
  { key: 'B', name: 'Une seule page, sans rail' },
  { key: 'C', name: 'Accueil « où en suis-je »' },
];

const KEY = 'prototype-espace-mj';

function load(): { variant: Variant; role: Role; gameMasterId: string | null } {
  const params = new URLSearchParams(location.search);
  let stored: Partial<ReturnType<typeof load>> = {};
  try {
    stored = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
  } catch {
    // Rien de gardé.
  }
  return {
    variant: (params.get('variante') as Variant) ?? stored.variant ?? 'A',
    role: (params.get('role') as Role) ?? stored.role ?? 'mj',
    gameMasterId: params.get('mj') ?? stored.gameMasterId ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class PrototypeState {
  private readonly initial = load();
  readonly variant = signal<Variant>(this.initial.variant);
  readonly role = signal<Role>(this.initial.role);
  private readonly chosenId = signal<string | null>(this.initial.gameMasterId);

  /** Le prototype ne s'affiche que si un rôle de MJ est simulé. */
  readonly active = computed(() => this.role() !== 'off');

  /** Pour B en MJ + Organisateur : l'espace affiché. */
  readonly organizerSide = signal(false);

  readonly gameMasters = apiResource(gameMasterEndpoints.list);
  private readonly list = currentValue(this.gameMasters);

  /** Le MJ « connecté » : celui de l'URL, sinon celui qui a le plus de scénarios. */
  readonly me = computed(() => {
    const list = this.list() ?? [];
    const chosen = list.find((gameMaster) => gameMaster.id === this.chosenId());
    if (chosen) return chosen;
    return [...list].sort((a, b) => b.scenarios.length - a.scenarios.length)[0] ?? null;
  });

  readonly variantName = computed(
    () => VARIANTS.find((variant) => variant.key === this.variant())?.name ?? '',
  );

  set(changes: { variant?: Variant; role?: Role; gameMasterId?: string }): void {
    if (changes.variant) this.variant.set(changes.variant);
    if (changes.role) this.role.set(changes.role);
    if (changes.gameMasterId) this.chosenId.set(changes.gameMasterId);
    this.organizerSide.set(false);
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          variant: this.variant(),
          role: this.role(),
          gameMasterId: this.chosenId(),
        }),
      );
    } catch {
      // Stockage refusé.
    }
  }
}
