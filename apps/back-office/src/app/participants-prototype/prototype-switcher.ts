/** PROTOTYPE, à jeter (#135). Barre flottante pour passer d'une variante à l'autre (← →). */
import { Component, HostListener, inject, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

export type VariantInfo = { key: string; name: string };

@Component({
  selector: 'app-prototype-switcher',
  template: `
    <button type="button" (click)="go(-1)" aria-label="Variante précédente">←</button>
    <span>{{ current() }} · {{ name() }}</span>
    <button type="button" (click)="go(1)" aria-label="Variante suivante">→</button>
  `,
  styles: `
    :host {
      position: fixed;
      bottom: 16px;
      left: 50%;
      z-index: 1000;
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 6px 14px;
      border-radius: 999px;
      background: #fff;
      color: #111;
      font: 600 14px system-ui;
      box-shadow: 0 4px 18px rgb(0 0 0 / 0.5);
      transform: translateX(-50%);
    }
    button {
      border: none;
      background: #eee;
      border-radius: 999px;
      padding: 2px 10px;
      cursor: pointer;
      font: inherit;
    }
  `,
})
export class PrototypeSwitcher {
  readonly variants = input.required<VariantInfo[]>();
  readonly current = input.required<string>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected name(): string {
    return this.variants().find((v) => v.key === this.current())?.name ?? '';
  }

  protected go(step: number): void {
    const keys = this.variants().map((v) => v.key);
    const at = keys.indexOf(this.current());
    const index = at < 0 ? 0 : (at + step + keys.length) % keys.length;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { variant: keys[index] } });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable], [role=dialog], [role=menu]')) return;
    if (event.key === 'ArrowLeft') this.go(-1);
    if (event.key === 'ArrowRight') this.go(1);
  }
}
