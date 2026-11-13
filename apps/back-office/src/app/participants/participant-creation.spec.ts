import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  apiUrl,
  participantEndpoints,
  type AddedParticipantDto,
  type ProblemDto,
} from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { ParticipantCreation } from './participant-creation';

const LINK = {
  url: 'https://chimeres.example.org/gestion/lien-d-acces/jeton',
  expiresAt: { date: '2027-03-21', time: '09:30' },
};

describe('Assistant « Créer un pseudo »', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  function open(options: { gameMaster?: boolean } = {}) {
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const closed = TestBed.inject(ParticipantCreation).open(options);
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve));
    };
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    const dialog = () => document.querySelector<HTMLElement>('app-participant-creation');
    const input = () => dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!;
    const checkbox = (role: 'game-master' | 'organizer') =>
      dialog()!.querySelector<HTMLInputElement>(`app-role-card[role="${role}"] input`)!;
    const button = (name: string) =>
      [...dialog()!.querySelectorAll('button')].find((b) => text(b) === name);
    const type = async (value: string) => {
      input().value = value;
      input().dispatchEvent(new Event('input'));
      await settle();
    };
    const errorText = () => {
      const ids = input().getAttribute('aria-describedby')?.split(' ') ?? [];
      return ids.map((id) => text(document.getElementById(id))).find(Boolean);
    };
    const add = () => http.expectOne(apiUrl(participantEndpoints.add));
    return {
      http,
      navigate,
      closed,
      settle,
      text,
      dialog,
      input,
      checkbox,
      button,
      type,
      errorText,
      add,
    };
  }

  it('sans rôle, crée un simple participant et ouvre sa fiche, sans lien (ID-12)', async () => {
    const { settle, type, button, checkbox, add, navigate, closed, dialog } = open();
    await settle();

    await type('  Élodie ');
    button('Suivant')!.click();
    await settle();
    expect(checkbox('game-master').checked).toBe(false);
    expect(checkbox('organizer').checked).toBe(false);
    button('Créer le pseudo')!.click();
    await settle();
    const request = add();
    expect(request.request.body).toEqual({ nickname: 'Élodie', roles: [] });
    const added: AddedParticipantDto = {
      participantId: 'p1',
      gameMasterId: null,
      accessLink: null,
    };
    request.flush(added);
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/participants', 'p1']);
    expect(dialog()).toBeNull();
    expect(await closed).toEqual(added);
  });

  it('« Ajouter un MJ » coche MJ d’avance, et montre le lien d’accès du compte créé', async () => {
    const { settle, type, button, checkbox, add, navigate, dialog, text } = open({
      gameMaster: true,
    });
    await settle();

    await type('Kaïros');
    button('Suivant')!.click();
    await settle();
    expect(checkbox('game-master').checked).toBe(true);
    checkbox('organizer').click();
    await settle();
    button('Créer le pseudo et son compte')!.click();
    await settle();
    const request = add();
    expect(request.request.body).toEqual({
      nickname: 'Kaïros',
      roles: ['game-master', 'organizer'],
    });
    request.flush({ participantId: 'p2', gameMasterId: 'g2', accessLink: LINK });
    await settle();

    expect(text(dialog()!.querySelector('h2'))).toBe(`Lien d'accès de «${NBSP}Kaïros${NBSP}»`);
    expect(dialog()!.querySelector<HTMLInputElement>('input[readonly]')!.value).toBe(LINK.url);
    button('Voir sa fiche')!.click();
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/participants', 'p2'], {
      queryParams: { onglet: 'compte' },
    });
    expect(dialog()).toBeNull();
  });

  it('ne passe pas aux rôles sans pseudo', async () => {
    const { settle, button, errorText, http, dialog } = open();
    await settle();

    button('Suivant')!.click();
    await settle();

    expect(errorText()).toBe('Donne un pseudo.');
    expect(button('Créer le pseudo')).toBeUndefined();
    expect(dialog()!.querySelector('app-role-card')).toBeNull();
    http.expectNone(apiUrl(participantEndpoints.add));
  });

  it('un pseudo déjà pris ramène au pseudo, avec un lien vers l’onglet « Compte » de sa fiche (ID-4)', async () => {
    const { settle, type, button, add, errorText, input, dialog } = open({ gameMaster: true });
    const message = `Le participant «${NBSP}Élodie${NBSP}» porte déjà ce pseudo${NBSP}: choisis-en un autre.`;
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:nickname-taken-by-participant',
      title: 'Pseudo déjà pris',
      status: 422,
      detail: message,
      code: 'nickname-taken-by-participant',
      params: { nickname: 'Élodie', participantId: 'p-elodie' },
      errors: [{ field: 'nickname', code: 'nickname-taken-by-participant', message }],
    };
    await settle();

    await type('elodie');
    button('Suivant')!.click();
    await settle();
    button('Créer le pseudo et son compte')!.click();
    await settle();
    add().flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(errorText()).toContain(message);
    expect(input().value).toBe('elodie');
    const link = dialog()!.querySelector<HTMLAnchorElement>('a[appFieldErrorAction]')!;
    expect(link.textContent?.trim()).toBe('Voir sa fiche');
    expect(link.getAttribute('href')).toBe('/participants/p-elodie?onglet=compte');
  });
});
