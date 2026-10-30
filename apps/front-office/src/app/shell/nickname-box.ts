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
        width: var(--popover-width);
        /* Sous le bouton du pseudo, à distance. */
        margin-top: var(--overlay-offset);
        padding: var(--space-l);
        border: 1px solid var(--edge);
        border-radius: var(--radius-card);
        background: var(--surface-3);
      }

      /* La pointe de 12 px, vers le pseudo : la boîte et le bouton partagent leur bord droit, et la
         pointe s'en écarte d'un pas. Sa moitié dépasse du filet. */
      :host::before {
        content: '';
        position: absolute;
        top: -7px;
        right: var(--space-xxl);
        width: 12px;
        height: 12px;
        border-top: 1px solid var(--edge);
        border-left: 1px solid var(--edge);
        background: var(--surface-3);
        rotate: 45deg;
      }

      strong {
        font-size: var(--font-size-mobile-section);
        overflow-wrap: anywhere;
      }
    }
  `,
})
export class NicknameBox {
  protected readonly nickname = inject<string>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<NicknameBoxResult>>(DialogRef);
}
