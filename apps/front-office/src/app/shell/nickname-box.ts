import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { Button } from '../ui/button';

/** Ce que la boîte du pseudo rend à sa fermeture : `change` sur « Changer de pseudo ». */
export type NicknameBoxResult = 'change';

/** La boîte qui s'ouvre d'un tap sur le pseudo, en haut de l'écran : le pseudo, et « Changer de pseudo ». */
@Component({
  selector: 'app-nickname-box',
  imports: [Button],
  template: `
    <span class="over">Ton pseudo</span>
    <strong>{{ nickname }}</strong>
    <button type="button" appButton="primary" (click)="ref.close('change')">
      Changer de pseudo
    </button>
  `,
  styles: `
    @layer components {
      :host {
        --edge: color-mix(in srgb, var(--accent) 60%, var(--border));
        position: relative;
        display: grid;
        gap: var(--space-s);
        width: 264px;
        padding: var(--space-l);
        border: 1px solid var(--edge);
        border-radius: var(--radius-card);
        background: var(--surface-3);
      }

      /* La pointe, vers le bouton du pseudo. */
      :host::before {
        content: '';
        position: absolute;
        top: -7px;
        right: 32px;
        width: 12px;
        height: 12px;
        border-top: 1px solid var(--edge);
        border-left: 1px solid var(--edge);
        background: var(--surface-3);
        rotate: 45deg;
      }

      .over {
        color: var(--text-muted);
        font-family: var(--font-caps);
        font-size: var(--font-size-overline);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      strong {
        font-size: var(--font-size-section);
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class NicknameBox {
  protected readonly nickname = inject<string>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<NicknameBoxResult>>(DialogRef);
}
