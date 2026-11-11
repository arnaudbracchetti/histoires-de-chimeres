import { Component, computed, inject, input } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { formatConventionDate } from '@chimeres/design';
import { ConventionStore } from '../convention/convention-store';
import { Rail } from '../shell/rail';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { PrototypeState } from './prototype-state';

/** Une entrée de rail, et une section qui les regroupe. */
type Entry = { label: string; icon: string; link: string };
type Section = { title: string | null; entries: Entry[] };

const ORGANIZER: Section[] = [
  {
    title: 'Préparation',
    entries: [
      { label: 'Calendrier', icon: 'calendar', link: '/' },
      { label: 'MJ', icon: 'users', link: '/mj' },
      { label: 'Scénarios', icon: 'book-open', link: '/scenarios' },
      { label: 'Créneaux et tables', icon: 'layout-grid', link: '/creneaux-et-tables' },
    ],
  },
  {
    title: 'Jour J',
    entries: [
      { label: 'Pilotage du jour J', icon: 'radio-tower', link: '/pilotage' },
      { label: 'Participants', icon: 'user-round', link: '/participants' },
      { label: 'Informations de connexion', icon: 'qr-code', link: '/informations-de-connexion' },
    ],
  },
];

/**
 * PROTOTYPE JETABLE (#171) : un rail aux entrées données, dans le style du vrai rail. Le pied
 * montre la personne connectée et « Se déconnecter » (inerte).
 */
@Component({
  selector: 'app-proto-rail',
  imports: [Button, Icon, RouterLink, RouterLinkActive],
  styleUrl: '../shell/rail.css',
  template: `
    <div class="brand">
      <svg class="emblem" aria-hidden="true" focusable="false">
        <use href="emblem.svg#emblem-small" />
      </svg>
      <span class="name">Histoires de Chimères</span>
    </div>
    @if (store.value(); as convention) {
      <div class="convention">
        <span class="convention-name">{{ convention.name }}</span>
        <span class="convention-date">{{ formatDate(convention.date) }}</span>
      </div>
    }
    <nav aria-label="Navigation principale">
      @for (section of sections(); track $index) {
        @if (section.title) {
          <h2 class="section">{{ section.title }}</h2>
        }
        <ul>
          @for (entry of section.entries; track entry.link) {
            <li>
              <a
                class="entry"
                [routerLink]="entry.link"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: entry.link === '/' }"
              >
                <app-icon [name]="entry.icon" />
                <span class="label">{{ entry.label }}</span>
              </a>
            </li>
          }
        </ul>
      }
    </nav>
    <div class="footer">
      @if (footerLink(); as link) {
        <a class="entry" [routerLink]="link.link" routerLinkActive="active">
          <app-icon name="user-round" />
          <span class="label">{{ link.label }}</span>
        </a>
      } @else {
        <p class="user">
          <app-icon name="user-round" />
          <span class="label">{{ who() }}</span>
        </p>
      }
      <button type="button" appButton="quiet">Se déconnecter</button>
    </div>
  `,
})
export class ProtoRail {
  readonly sections = input.required<Section[]>();
  readonly who = input.required<string>();
  readonly footerLink = input<Entry | null>(null);
  protected readonly store = inject(ConventionStore);
  protected readonly formatDate = formatConventionDate;
}

/**
 * PROTOTYPE JETABLE (#171) : la navigation de l'espace du MJ, selon la variante et le rôle
 * simulés. Remplace le vrai rail tant que le prototype est actif.
 */
@Component({
  selector: 'app-mj-shell',
  imports: [Button, ProtoRail, Rail, RouterLink],
  host: { '[class.top]': 'state.variant() === "B"' },
  template: `
    @let me = state.me();
    @let nickname = me?.nickname ?? '…';
    @switch (state.variant()) {
      @case ('A') {
        @if (state.role() === 'mj') {
          <app-proto-rail [sections]="mjA()" [who]="nickname + ' · MJ'" />
        } @else {
          <app-proto-rail [sections]="orgaA()" [who]="nickname + ' · MJ et Organisateur'" />
        }
      }
      @case ('B') {
        <header>
          <svg class="emblem" aria-hidden="true" focusable="false">
            <use href="emblem.svg#emblem-small" />
          </svg>
          <span class="name">Histoires de Chimères</span>
          @if (store.value(); as convention) {
            <span class="convention">{{ convention.name }} · {{ formatDate(convention.date) }}</span>
          }
          @if (state.role() === 'mj-orga') {
            <div class="switch" role="group" aria-label="Espace">
              <a
                routerLink="/prototype-espace-mj/ma-fiche"
                [class.on]="!organizerSide()"
                >Mon espace MJ</a
              >
              <a routerLink="/" [class.on]="organizerSide()">Organisation</a>
            </div>
          }
          <span class="spacer"></span>
          <span class="who">{{ nickname }}</span>
          <button type="button" appButton="quiet">Se déconnecter</button>
        </header>
        @if (state.role() === 'mj-orga' && organizerSide()) {
          <app-rail />
        }
      }
      @case ('C') {
        @if (state.role() === 'mj') {
          <app-proto-rail [sections]="mjC" [who]="nickname + ' · MJ'" />
        } @else {
          <app-proto-rail
            [sections]="organizer"
            who=""
            [footerLink]="{ label: nickname + ' · ma fiche de MJ', icon: 'user-round', link: '/mj/' + me?.id }"
          />
        }
      }
    }
  `,
  styles: `
    @layer components {
      :host {
        display: contents;
      }

      header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3.5rem;
        z-index: 4;
        display: flex;
        gap: var(--space-m);
        align-items: center;
        padding: var(--space-s) var(--space-xl);
        border-bottom: 1px solid var(--border);
        background: var(--surface-1);
      }

      .emblem {
        width: 1.5rem;
        height: 1.5rem;
      }

      .name {
        font-family: var(--font-display);
        font-size: var(--font-size-block);
      }

      .convention,
      .who {
        color: var(--text-muted);
      }

      .spacer {
        flex: 1;
      }

      .switch {
        display: flex;
        margin-left: var(--space-l);
        border: 1px solid var(--border);
        border-radius: var(--radius-control);
        overflow: hidden;

        a {
          padding: var(--space-xs) var(--space-m);
          color: var(--text);
          text-decoration: none;
        }

        a.on {
          background: var(--accent);
          color: var(--on-accent);
        }
      }
    }
  `,
})
export class MjShell {
  protected readonly state = inject(PrototypeState);
  protected readonly store = inject(ConventionStore);
  protected readonly formatDate = formatConventionDate;
  protected readonly organizer = ORGANIZER;
  private readonly router = inject(Router);

  /** B en MJ + Organisateur : côté Organisation dès qu'on quitte les pages de l'espace du MJ. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly organizerSide = computed(() => {
    const url = this.url();
    // Les pages réelles qu'ouvre l'espace du MJ (un scénario, en proposer un) n'en sortent pas.
    return !(url.startsWith('/prototype-espace-mj') || url.startsWith('/scenarios/') || url.includes('/nouveau-scenario'));
  });

  protected readonly mjA = computed<Section[]>(() => [
    {
      title: null,
      entries: [
        { label: 'Ma fiche', icon: 'house', link: '/prototype-espace-mj/ma-fiche' },
        { label: 'Scénarios de la convention', icon: 'book-open', link: '/prototype-espace-mj/scenarios' },
      ],
    },
  ]);

  protected readonly orgaA = computed<Section[]>(() => [
    {
      title: 'Mon espace MJ',
      entries: [{ label: 'Ma fiche', icon: 'house', link: '/prototype-espace-mj/ma-fiche' }],
    },
    ...ORGANIZER,
  ]);

  protected readonly mjC: Section[] = [
    {
      title: null,
      entries: [
        { label: 'Accueil', icon: 'house', link: '/prototype-espace-mj/accueil' },
        { label: 'Mes disponibilités', icon: 'clock', link: '/prototype-espace-mj/disponibilites' },
        { label: 'Mes scénarios', icon: 'sparkles', link: '/prototype-espace-mj/mes-scenarios' },
        { label: 'Scénarios de la convention', icon: 'book-open', link: '/prototype-espace-mj/scenarios' },
      ],
    },
  ];
}
