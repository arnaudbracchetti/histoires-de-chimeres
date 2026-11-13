import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  accountEndpoints,
  apiUrl,
  conventionEndpoints,
  gameMasterEndpoints,
  type ConnectedAccountDto,
  type GameMasterSheetDto,
  type ProblemDto,
} from '@chimeres/contract';
import { NBSP, THIN_NBSP } from '@chimeres/design';
import { GameMasterPage } from './game-master-page';

@Component({ template: '' })
class Empty {}

const ORGANIZER: ConnectedAccountDto = {
  participantId: 'p-orga',
  nickname: 'Kaïros',
  organizer: true,
  gameMasterId: null,
};
/** Élodie, MJ seule, connectée : son MJ est g1. */
const ELODIE: ConnectedAccountDto = {
  participantId: 'p-elodie',
  nickname: 'Élodie',
  organizer: false,
  gameMasterId: 'g1',
};
const TIME_SLOTS = [
  { id: 't1', rank: 1, start: '10:00', end: '12:00', availableGameMasters: 1 },
  { id: 't2', rank: 2, start: '14:00', end: '16:00', availableGameMasters: 0 },
];

describe('GameMasterPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'mj', component: Empty }]),
      ],
    });
  });

  async function render(
    response:
      | (Omit<GameMasterSheetDto, 'id' | 'scenarios' | 'games' | 'withdrawals'> &
          Partial<GameMasterSheetDto>)
      | 'not-found' = {
      nickname: 'Élodie',
      availabilities: [],
    },
    {
      account = ORGANIZER,
      mine = false,
      timeSlots = [],
    }: { account?: ConnectedAccountDto; mine?: boolean; timeSlots?: typeof TIME_SLOTS } = {},
  ) {
    const fixture = TestBed.createComponent(GameMasterPage);
    if (mine) fixture.componentRef.setInput('mine', true);
    else fixture.componentRef.setInput('id', 'g1');
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(accountEndpoints.read)).flush(account);
    // Sans attendre la stabilité : la convention, encore à servir, la retiendrait.
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    const read = http.expectOne(apiUrl(gameMasterEndpoints.read, { gameMasterId: 'g1' }));
    if (response === 'not-found') read.flush(null, { status: 404, statusText: 'Introuvable' });
    else read.flush({ id: 'g1', scenarios: [], games: [], withdrawals: [], ...response });
    http
      .expectOne(apiUrl(conventionEndpoints.read))
      .flush({ id: 'c1', name: 'Histoires de Chimères', date: null, tables: [], timeSlots });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    const button = (name: string) =>
      [...document.querySelectorAll('button')].find(
        (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
      );
    const input = () => host.querySelector<HTMLInputElement>('app-nickname-editor input');
    const type = async (value: string) => {
      input()!.value = value;
      input()!.dispatchEvent(new Event('input'));
      input()!.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    const press = async (key: 'Enter' | 'Escape') => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await settle();
    };
    const errorText = () => {
      const ids = input()!.getAttribute('aria-describedby')?.split(' ') ?? [];
      return ids.map((id) => text(host.querySelector(`#${id}`))).find(Boolean);
    };
    return { host, http, settle, text, button, input, type, press, errorText };
  }

  it('montre le pseudo tel qu’il a été saisi, sous le fil « MJ › pseudo »', async () => {
    const { host, text } = await render({ nickname: 'Élodie', availabilities: [] });

    expect(text(host.querySelector('h1'))).toBe('Élodie');
    const crumbs = [...host.querySelectorAll('nav[aria-label="Fil d\'Ariane"] li')].map(text);
    expect(crumbs).toEqual(['MJ', 'Élodie']);
  });

  it('« Proposer un scénario » mène à la création d’un scénario de ce MJ', async () => {
    const { host, text } = await render();

    const link = [...host.querySelectorAll('a')].find((a) => text(a) === 'Proposer un scénario');
    expect(link?.getAttribute('href')).toBe('/mj/g1/nouveau-scenario');
  });

  it('liste ses scénarios, chacun avec son illustration par défaut', async () => {
    const { host, text } = await render({
      nickname: 'Élodie',
      availabilities: [],
      scenarios: [
        {
          id: 's1',
          title: "La Tour d'ébène",
          system: "L'Appel de Cthulhu",
          seats: { min: 3, max: 5 },
          duration: 2,
          imageUrl: null,
        },
      ],
    });

    const item = host.querySelector('.scenarios li')!;
    expect(item.querySelector('a')?.getAttribute('href')).toBe('/scenarios/s1');
    expect([...item.querySelectorAll('a, .meta')].map(text)).toEqual([
      "La Tour d'ébène",
      "L'Appel de Cthulhu",
      `3 à 5${NBSP}places`,
      `2${NBSP}créneaux`,
    ]);
    const illustration = item.querySelector('app-scenario-illustration svg')!;
    expect(illustration.getAttribute('aria-hidden')).toBe('true');
    expect(text(illustration.querySelector('text'))).toBe('T');
  });

  it('dit qu’il n’a aucun scénario', async () => {
    const { host, text } = await render();

    expect(text(host.querySelector('.panel .none'))).toBe("Aucun scénario pour l'instant.");
  });

  it('le crayon ouvre le champ en place ; Entrée enregistre le pseudo', async () => {
    const { host, http, settle, text, button, input, type, press } = await render();

    button('Modifier le pseudo')!.click();
    await settle();
    expect(host.querySelector('h1')).toBeNull();
    expect(input()!.value).toBe('Élodie');
    expect(document.activeElement).toBe(input());
    await type('Élodie la Rouge');
    await press('Enter');
    const request = http.expectOne(apiUrl(gameMasterEndpoints.rename, { gameMasterId: 'g1' }));
    expect(request.request.body).toEqual({ nickname: 'Élodie la Rouge' });
    request.flush({
      id: 'g1',
      nickname: 'Élodie la Rouge',
      availabilities: [],
      scenarios: [],
      games: [],
    });
    await settle();

    expect(input()).toBeNull();
    expect(text(host.querySelector('h1'))).toBe('Élodie la Rouge');
    expect(document.activeElement).toBe(button('Modifier le pseudo'));
  });

  it('Échap ferme le champ sans rien enregistrer', async () => {
    const { host, http, text, button, settle, type, press, input } = await render();
    button('Modifier le pseudo')!.click();
    await settle();

    await type('Kaïros');
    await press('Escape');

    http.expectNone(apiUrl(gameMasterEndpoints.rename, { gameMasterId: 'g1' }));
    expect(input()).toBeNull();
    expect(text(host.querySelector('h1'))).toBe('Élodie');
    expect(document.activeElement).toBe(button('Modifier le pseudo'));
  });

  it('affiche sous le champ le refus de l’API', async () => {
    const { http, button, settle, type, press, errorText, input } = await render();
    const message = `Le MJ «${NBSP}Kaïros${NBSP}» porte déjà ce pseudo${NBSP}: choisis-en un autre.`;
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:nickname-taken',
      title: 'Pseudo déjà pris',
      status: 422,
      detail: message,
      code: 'nickname-taken',
      errors: [{ field: 'nickname', code: 'nickname-taken', message }],
    };
    button('Modifier le pseudo')!.click();
    await settle();

    await type('kairos');
    await press('Enter');
    http
      .expectOne(apiUrl(gameMasterEndpoints.rename, { gameMasterId: 'g1' }))
      .flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(errorText()).toBe(message);
    expect(input()!.value).toBe('kairos');
  });

  it('« ⋯ » puis « Supprimer le MJ » demande confirmation, avec ses disponibilités, supprime, et revient à la liste', async () => {
    const { http, button, settle, text } = await render({
      nickname: 'Élodie',
      availabilities: ['s1', 's2'],
    });
    const router = TestBed.inject(Router);

    button('Autres actions sur le MJ')!.click();
    await settle();
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (element) => text(element) === 'Supprimer le MJ',
    )!;
    item.click();
    await settle();
    expect(text(document.querySelector('[role="alertdialog"] h2'))).toBe(
      `Supprimer le MJ «${NBSP}Élodie${NBSP}»${THIN_NBSP}?`,
    );
    expect(text(document.querySelector('[role="alertdialog"] p'))).toBe(
      `Ses 2${NBSP}disponibilités seront supprimées.`,
    );
    [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
      .find((b) => text(b) === 'Supprimer le MJ')!
      .click();
    http
      .expectOne(apiUrl(gameMasterEndpoints.remove, { gameMasterId: 'g1' }))
      .flush(null, { status: 204, statusText: 'No Content' });
    // Les nombres de disponibilités des créneaux ont changé : la convention est relue.
    await new Promise((resolve) => setTimeout(resolve));
    http
      .expectOne(apiUrl(conventionEndpoints.read))
      .flush({ id: 'c1', name: 'Histoires de Chimères', date: null, tables: [], timeSlots: [] });
    await settle();

    expect(router.url).toBe('/mj');
  });

  it('un MJ qui a un scénario : le refus de l’API s’affiche dans le dialogue, qui ne garde que « Fermer » (PR-12)', async () => {
    const { http, button, settle, text } = await render();
    const detail = `Ce MJ a un scénario${NBSP}: supprime-le d'abord.`;
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:game-master-has-scenarios',
      title: 'MJ avec des scénarios',
      status: 422,
      detail,
      code: 'game-master-has-scenarios',
    };
    const dialogButtons = () =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].map(text);

    button('Autres actions sur le MJ')!.click();
    await settle();
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((element) => text(element) === 'Supprimer le MJ')!
      .click();
    await settle();
    [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
      .find((b) => text(b) === 'Supprimer le MJ')!
      .click();
    http
      .expectOne(apiUrl(gameMasterEndpoints.remove, { gameMasterId: 'g1' }))
      .flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(text(document.querySelector('[role="alertdialog"] [role="alert"]'))).toBe(detail);
    expect(dialogButtons()).toEqual(['Fermer']);
  });

  it('« Ma fiche » : titrée par son pseudo, sans crayon, sans « ⋯ » ni fil d’Ariane, sur l’onglet « Mes scénarios »', async () => {
    const { host, text, button } = await render(
      { nickname: 'Élodie', availabilities: ['t1'] },
      { account: ELODIE, mine: true, timeSlots: TIME_SLOTS },
    );

    expect(text(host.querySelector('h1'))).toBe('Élodie');
    expect(host.querySelector('nav[aria-label="Fil d\'Ariane"]')).toBeNull();
    expect(button('Modifier le pseudo')).toBeUndefined();
    expect(button('Autres actions sur le MJ')).toBeUndefined();
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    expect(tabs.map(text)).toEqual(['Mes scénarios', 'Mes disponibilités 1 / 2', 'Mes parties']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    const propose = [...host.querySelectorAll('a')].find((a) => text(a) === 'Proposer un scénario');
    expect(propose?.getAttribute('href')).toBe('/mj/g1/nouveau-scenario');
  });

  it('« Mes parties » : le créneau, le scénario et la table de chaque partie', async () => {
    const { host, text, settle } = await render(
      {
        nickname: 'Élodie',
        availabilities: ['t2'],
        games: [
          {
            gameId: 'p1',
            timeSlotId: 't2',
            table: { id: 'tb1', name: 'Table 3' },
            scenario: { id: 's1', title: "La Tour d'ébène" },
          },
        ],
      },
      { account: ELODIE, mine: true, timeSlots: TIME_SLOTS },
    );

    host.querySelector<HTMLButtonElement>('#tab-games')!.click();
    await settle();

    const row = host.querySelector('.games li')!;
    expect([...row.children].map(text)).toEqual([
      `Créneau 2 · 14${NBSP}h${NBSP}00${THIN_NBSP}–${THIN_NBSP}16${NBSP}h${NBSP}00`,
      "La Tour d'ébène",
      'Table 3',
    ]);
    expect(row.querySelector('a')?.getAttribute('href')).toBe('/scenarios/s1');
  });

  it('un MJ seul sur sa propre fiche par son URL : aucun geste d’Organisateur', async () => {
    const { host, button } = await render(undefined, { account: ELODIE });

    expect(host.querySelector('nav[aria-label="Fil d\'Ariane"]')).toBeNull();
    expect(button('Modifier le pseudo')).toBeUndefined();
    expect(button('Autres actions sur le MJ')).toBeUndefined();
  });

  it('un MJ inconnu : un message sobre à la place de la fiche', async () => {
    const { host, text, button } = await render('not-found');

    expect(text(host.querySelector('app-loadable'))).toContain("Ce MJ n'existe pas, ou plus.");
    expect(text(host.querySelector('h1'))).toBe('Fiche du MJ');
    expect(button('Modifier le pseudo')).toBeUndefined();
  });
});
