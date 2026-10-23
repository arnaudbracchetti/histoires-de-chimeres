import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, signal, type Signal } from '@angular/core';
import { readProblem } from './problem';
import { Notifications, type ErrorNotice } from './shell/notifications';

/**
 * Refus qui disent que l'écran est périmé : l'élément n'existe plus (404), la convention a changé
 * entre-temps (409), ou le domaine refuse ce que l'écran proposait (422). Une coupure ou une
 * erreur 500 ne dit rien de l'écran : il reste tel quel, pour réessayer.
 */
const STALE_STATUSES = [404, 409, 422];

/** La clé d'un geste lancé sans clé. */
const NO_KEY = '';

/** Un geste refusé par l'API, ou qui n'a pas pu l'atteindre. */
export type GestureRefusal = {
  /** Le texte à afficher en place : le `detail` du refus, à défaut son `title`. */
  message: string;
  /** Le refus en notification : `title` et `detail`. */
  notice: ErrorNotice;
  /** L'écran est à relire. */
  stale: boolean;
};

export type GestureOutcome<T> =
  | { status: 'done'; value: T }
  | { status: 'refused'; refusal: GestureRefusal }
  /** Un envoi de la même clé attend encore sa réponse : rien n'est parti. */
  | { status: 'busy' };

/**
 * Une écriture lancée par un geste hors formulaire (docs/design/patterns.md, Erreur hors
 * formulaire) : un clic qui écrit aussitôt, et que l'API peut refuser.
 */
export type Gesture = {
  /**
   * Lance `action`, sauf si un envoi de la même clé attend sa réponse. Une clé (l'identifiant
   * d'un créneau) laisse partir en même temps des envois de clés différentes. La promesse ne
   * rejette jamais : un refus est un `GestureOutcome`.
   */
  run<T>(action: () => Promise<T>, key?: string): Promise<GestureOutcome<T>>;
  /** Un envoi, de n'importe quelle clé, attend sa réponse. */
  readonly running: Signal<boolean>;
  isRunning(key: string): boolean;
  /** Le refus du dernier envoi, effacé au suivant. */
  readonly refusal: Signal<GestureRefusal | undefined>;
};

/**
 * Renvoie un `Gesture`, à créer dans un contexte d'injection (champ d'un composant). L'écran
 * choisit où afficher le refus (`refusal().message` en place, ou `notify` pour une notification)
 * et quoi relire quand il est périmé (`refusal.stale`).
 */
export function injectGesture(options: { notify?: boolean } = {}): Gesture {
  const notifications = inject(Notifications);
  const keys = signal<ReadonlySet<string>>(new Set());
  const refusal = signal<GestureRefusal | undefined>(undefined);

  const update = (key: string, running: boolean) =>
    keys.update((current) => {
      const next = new Set(current);
      if (running) next.add(key);
      else next.delete(key);
      return next;
    });

  return {
    running: computed(() => keys().size > 0),
    isRunning: (key) => keys().has(key),
    refusal: refusal.asReadonly(),
    async run(action, key = NO_KEY) {
      if (keys().has(key)) return { status: 'busy' };
      update(key, true);
      refusal.set(undefined);
      try {
        return { status: 'done', value: await action() };
      } catch (error) {
        const refused = refusalOf(error);
        refusal.set(refused);
        if (options.notify) notifications.error(refused.notice);
        return { status: 'refused', refusal: refused };
      } finally {
        update(key, false);
      }
    },
  };
}

function refusalOf(error: unknown): GestureRefusal {
  const { alert, fieldErrors } = readProblem(error);
  const notice = alert ?? { title: fieldErrors.map(({ message }) => message).join(' ') };
  return {
    message: notice.detail ?? notice.title,
    notice,
    stale: error instanceof HttpErrorResponse && STALE_STATUSES.includes(error.status),
  };
}
