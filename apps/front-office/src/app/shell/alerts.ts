import { Injectable, signal } from '@angular/core';

/** Une erreur hors formulaire : le `title` et le `detail` d'un Problem Details, affichés tels quels. */
export type ErrorNotice = {
  title: string;
  detail?: string;
};

/**
 * Ce qui change pour le participant sans geste de sa part (NO-5) : `see`, l'adresse que « Voir »
 * ouvre, depuis la racine du front office.
 */
export type ChangeNotice = ErrorNotice & { see: string };

type Notice = ErrorNotice & { id: number; see?: string };

/** Au-delà, la plus ancienne se ferme (docs/design/patterns.md, Retours d'action). */
const MAX_NOTICES = 3;

/**
 * Pile des alertes de l'application : les erreurs, et les changements (`see`). Une alerte reste
 * affichée jusqu'à ce qu'on la ferme, ou qu'on touche « Voir ».
 */
@Injectable({ providedIn: 'root' })
export class Alerts {
  private nextId = 0;
  private readonly stack = signal<readonly Notice[]>([]);
  readonly notices = this.stack.asReadonly();

  error(notice: ErrorNotice): void {
    this.push(notice);
  }

  change(notice: ChangeNotice): void {
    this.push(notice);
  }

  close(id: number): void {
    this.stack.update((notices) => notices.filter((notice) => notice.id !== id));
  }

  private push(notice: ErrorNotice | ChangeNotice): void {
    this.stack.update((notices) =>
      [...notices, { ...notice, id: this.nextId++ }].slice(-MAX_NOTICES),
    );
  }
}
