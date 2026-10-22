import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

const APP_NAME = 'Histoires de Chimères';

/** Titre de l'onglet : « Scénarios — Histoires de Chimères ». */
@Injectable({ providedIn: 'root' })
export class PageTitle extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} — ${APP_NAME}` : APP_NAME);
  }
}
