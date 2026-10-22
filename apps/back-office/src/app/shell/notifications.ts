import { Injectable, signal } from '@angular/core';

/** Une erreur hors formulaire : le `title` et le `detail` d'un Problem Details, affichés tels quels. */
export type ErrorNotice = {
  title: string;
  detail?: string;
};

type Notice = ErrorNotice & { id: number };

/** Au-delà, la plus ancienne se ferme (docs/design/patterns.md, Retours d'action). */
const MAX_NOTICES = 3;

/** Pile des notifications d'erreur de la coquille. Une erreur reste affichée jusqu'à ce qu'on la ferme. */
@Injectable({ providedIn: 'root' })
export class Notifications {
  private nextId = 0;
  private readonly stack = signal<readonly Notice[]>([]);
  readonly notices = this.stack.asReadonly();

  error(notice: ErrorNotice): void {
    this.stack.update((notices) =>
      [...notices, { ...notice, id: this.nextId++ }].slice(-MAX_NOTICES),
    );
  }

  close(id: number): void {
    this.stack.update((notices) => notices.filter((notice) => notice.id !== id));
  }
}
