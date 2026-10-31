import { Component, inject } from '@angular/core';
import { frontOfficeUrls } from '@chimeres/contract';
import { fr } from '@chimeres/design';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { AppInstallation } from './app-installation';
import { InstallMenuPath } from './install-menu-path';

/**
 * En tête de l'Accueil, sur Android dans le navigateur : « Conseil : Installe l'application », jusqu'à son
 * « Plus tard » ; une fois l'application installée, « Ouvrir l'application », tant qu'on reste
 * dans le navigateur (stories 37 et 39).
 */
@Component({
  selector: 'app-install-advice',
  imports: [Button, Icon, InstallMenuPath],
  template: `
    @switch (installation.advice()) {
      @case ('install') {
        <section class="card" aria-labelledby="install-advice">
          <span class="over">Conseil</span>
          <h2 id="install-advice">Installe l'application</h2>
          <p class="meta">{{ installText }}</p>
          @if (!installation.armed()) {
            <p class="meta"><app-install-menu-path /></p>
          }
          <div class="actions">
            @if (installation.armed()) {
              <button type="button" appButton="primary" (click)="installation.install()">
                <app-icon name="download" />
                Installer
              </button>
            }
            <button type="button" appButton="quiet" (click)="installation.dismissAdvice()">
              Plus tard
            </button>
          </div>
        </section>
      }
      @case ('open') {
        <section class="card" aria-labelledby="open-advice">
          <span class="over">Tu es dans le navigateur</span>
          <h2 id="open-advice">L'application est installée</h2>
          <p class="meta">{{ openText }}</p>
          <div class="actions">
            <a appButton="primary" [href]="appUrl" target="_blank">Ouvrir l'application</a>
          </div>
        </section>
      }
    }
  `,
  styles: `
    @layer components {
      :host {
        display: contents;
      }

      .card {
        display: grid;
        gap: var(--space-s);
        padding: var(--space-l);
        border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
        border-radius: var(--radius-card);
        background: var(--surface-2);
      }

      h2 {
        font-family: var(--font-ui);
        font-size: var(--font-size-mobile-body);
        font-weight: 600;
      }

      .meta {
        color: var(--text-muted);
        font-size: var(--font-size-mobile-meta);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-s);
      }
    }
  `,
})
export class InstallAdvice {
  protected readonly installation = inject(AppInstallation);
  protected readonly appUrl = frontOfficeUrls.home();
  protected readonly installText = fr`Elle s'ouvre d'un tap depuis l'écran d'accueil, avec ta table en premier, et les notifications l'ouvrent directement.`;
  protected readonly openText = fr`Ouvre-la : c'est elle que les notifications ouvrent.`;
}
