import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  conventionEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type ProblemDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { Alerts } from '../shell/alerts';
import { NBSP, THIN_NBSP } from '@chimeres/design';
import { TimeSlotList } from './time-slot-list';

/** « 14 h 00 – 16 h 30 ». */
const range = (start: string, end: string) => `${start}${THIN_NBSP}–${THIN_NBSP}${end}`;

/** Créneaux de la journée, rangs recalculés comme le fait l'API. */
function conventionWith(...hours: [string, string][]): ConventionDto {
  const timeSlots: TimeSlotDto[] = [...hours]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, end], index) => ({
      id: `s-${start}`,
      rank: index + 1,
      start,
      end,
      availabilityCount: 0,
    }));
  return {
    id: 'c1',
    name: 'Histoires de Chimères',
    date: null,
    timeSlots,
    tables: [],
    end: null,
    presenceCode: 'K7M2',
  };
}

describe('TimeSlotList', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render(convention = conventionWith()) {
    const fixture = TestBed.createComponent(TimeSlotList);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(conventionEndpoints.read)).flush(convention);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    /** Chaque carte affichée : titre, plage, durée. */
    const cards = () =>
      [...host.querySelectorAll('article.card:not(.editing)')].map((card) =>
        ['h3', '.range', '.duration'].map((selector) => text(card.querySelector(selector))),
      );
    const pauses = () => [...host.querySelectorAll('.pause')].map(text);
    const editor = () => host.querySelector<HTMLElement>('article.editing');
    const input = (name: 'Début' | 'Fin') =>
      [...(editor()?.querySelectorAll('label') ?? [])].find((label) => text(label) === name)!
        .control as HTMLInputElement;
    const type = async (name: 'Début' | 'Fin', value: string) => {
      const field = input(name);
      field.value = value;
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    const press = async (key: 'Enter' | 'Escape') => {
      (document.activeElement ?? input('Début')).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
      await fixture.whenStable();
    };
    /** Un bouton, par son nom accessible (`aria-label`, sinon son texte). */
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find(
        (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
      )!;
    const errorOf = (name: 'Début' | 'Fin') => {
      const ids = input(name).getAttribute('aria-describedby')?.split(' ') ?? [];
      return ids.map((id) => text(host.querySelector(`#${id}`))).find(Boolean);
    };
    const dialogButton = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
        (b) => text(b) === name,
      )!;
    return {
      fixture,
      text,
      host,
      http,
      cards,
      pauses,
      editor,
      input,
      type,
      press,
      button,
      errorOf,
      dialogButton,
      settle,
    };
  }

  it('montre une carte par créneau, dans l’ordre de la journée, et la pause entre deux', async () => {
    const { cards, pauses } = await render(
      conventionWith(['14:00', '16:30'], ['09:00', '12:30'], ['16:30', '18:00']),
    );

    expect(cards()).toEqual([
      ['Créneau 1', range(`9${NBSP}h${NBSP}00`, `12${NBSP}h${NBSP}30`), `3${NBSP}h${NBSP}30`],
      ['Créneau 2', range(`14${NBSP}h${NBSP}00`, `16${NBSP}h${NBSP}30`), `2${NBSP}h${NBSP}30`],
      ['Créneau 3', range(`16${NBSP}h${NBSP}30`, `18${NBSP}h${NBSP}00`), `1${NBSP}h${NBSP}30`],
    ]);
    expect(pauses()).toEqual([`pause de 1${NBSP}h${NBSP}30`, 'bout à bout']);
  });

  it('ajoute à la chaîne : début à la fin du dernier créneau, fin 2 h 30 après', async () => {
    const { button, editor, input, http, settle, cards, text } = await render(
      conventionWith(['09:00', '11:30']),
    );

    button('Ajouter un créneau').click();
    await settle();
    expect(text(editor()?.querySelector('h3'))).toBe('Nouveau créneau');
    expect(document.activeElement).toBe(input('Début'));
    expect([input('Début').value, input('Fin').value]).toEqual(['11:30', '14:00']);
    button('Ajouter le créneau').click();
    await settle();
    const request = http.expectOne(apiUrl(timeSlotEndpoints.add));
    expect(request.request.body).toEqual({ start: '11:30', end: '14:00' });
    request.flush(conventionWith(['09:00', '11:30'], ['11:30', '14:00']));
    await settle();

    expect(cards().map(([title]) => title)).toEqual(['Créneau 1', 'Créneau 2']);
    expect([input('Début').value, input('Fin').value]).toEqual(['14:00', '16:30']);
    expect(document.activeElement).toBe(input('Début'));
  });

  it('propose la fin 2 h 30 après le début saisi, sur 24 heures, en texte libre', async () => {
    const { button, type, input, press, http, settle } = await render();
    button('Ajouter un créneau').click();
    await settle();

    expect(input('Début').placeholder).toBe('hh:mm');
    await type('Début', '14h');
    expect(input('Fin').value).toBe('16:30');
    await press('Enter');

    expect(http.expectOne(apiUrl(timeSlotEndpoints.add)).request.body).toEqual({
      start: '14:00',
      end: '16:30',
    });
  });

  it('refuse sous son champ une heure qui n’en est pas une, sans rien envoyer', async () => {
    const { button, type, press, http, settle, errorOf } = await render();
    button('Ajouter un créneau').click();
    await settle();

    await type('Début', '25:00');
    await press('Enter');
    await settle();

    http.expectNone(apiUrl(timeSlotEndpoints.add));
    expect(errorOf('Début')).toBe(`Écris l'heure sur 24${NBSP}heures, de 00:00 à 23:59.`);
  });

  it('quitter un champ vide n’affiche rien ; l’heure manquante est signalée à l’enregistrement', async () => {
    const { button, type, press, settle, errorOf, http } = await render();
    button('Ajouter un créneau').click();
    await settle();

    await type('Début', '');
    await type('Fin', '');
    expect(errorOf('Début')).toBeUndefined();
    await press('Enter');
    await settle();

    http.expectNone(apiUrl(timeSlotEndpoints.add));
    expect(errorOf('Début')).toBe("Indique l'heure de début.");
  });

  it('« Annuler » ferme la saisie, et rend le focus à « Ajouter un créneau »', async () => {
    const { button, settle, editor, http } = await render();
    button('Ajouter un créneau').click();
    await settle();

    button('Annuler').click();
    await settle();

    http.expectNone(apiUrl(timeSlotEndpoints.add));
    expect(editor()).toBeNull();
    expect(document.activeElement).toBe(button('Ajouter un créneau'));
  });

  it('Échap ferme la saisie, sauf pendant un enregistrement', async () => {
    const { button, type, press, settle, editor, http, cards } = await render();
    button('Ajouter un créneau').click();
    await settle();
    await type('Début', '14:00');

    await press('Enter');
    await press('Escape');
    http.expectOne(apiUrl(timeSlotEndpoints.add)).flush(conventionWith(['14:00', '16:30']));
    await settle();
    expect(cards().map(([title]) => title)).toEqual(['Créneau 1']);
    expect(editor()).not.toBeNull();

    await press('Escape');
    await settle();
    expect(editor()).toBeNull();
  });

  it('affiche sous la fin un chevauchement refusé par l’API, focus sur la fin', async () => {
    const { button, type, press, http, settle, errorOf, input } = await render();
    const message = `Ce créneau empiète sur le créneau 1${NBSP}: avance sa fin.`;
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:time-slot-end-overlaps',
      title: 'Chevauchement',
      status: 422,
      detail: message,
      code: 'time-slot-end-overlaps',
      errors: [{ field: 'end', code: 'time-slot-end-overlaps', message }],
    };
    button('Ajouter un créneau').click();
    await settle();

    await type('Début', '12:00');
    await press('Enter');
    http
      .expectOne(apiUrl(timeSlotEndpoints.add))
      .flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(errorOf('Fin')).toBe(message);
    expect(input('Fin').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('Fin'));
  });

  it('envoie en alerte une erreur sans champ, sans perdre la saisie', async () => {
    const { button, type, press, http, settle, input } = await render();
    button('Ajouter un créneau').click();
    await settle();

    await type('Début', '14:00');
    await press('Enter');
    http
      .expectOne(apiUrl(timeSlotEndpoints.add))
      .flush(null, { status: 500, statusText: 'Erreur' });
    await settle();

    expect(TestBed.inject(Alerts).notices()).toEqual([
      expect.objectContaining({ title: 'Une erreur est survenue, réessaie.' }),
    ]);
    expect(input('Début').value).toBe('14:00');
  });

  it('« Modifier » retourne la carte en formulaire, et « Enregistrer » change ses heures', async () => {
    const { button, editor, input, type, http, settle, cards, host, text } = await render(
      conventionWith(['09:00', '11:30'], ['14:00', '16:30']),
    );

    button('Modifier le créneau 1').click();
    await settle();
    expect(text(editor()?.querySelector('h3'))).toBe('Modifier le créneau 1');
    expect([input('Début').value, input('Fin').value]).toEqual(['09:00', '11:30']);
    // Les autres cartes s'estompent le temps de la saisie.
    expect(host.querySelector('article.card:not(.editing)')?.classList).toContain('dimmed');
    await type('Fin', '12:00');
    button('Enregistrer').click();
    await settle();
    const request = http.expectOne(
      apiUrl(timeSlotEndpoints.changeHours, { timeSlotId: 's-09:00' }),
    );
    expect(request.request.body).toEqual({ start: '09:00', end: '12:00' });
    request.flush(conventionWith(['09:00', '12:00'], ['14:00', '16:30']));
    await settle();

    expect(editor()).toBeNull();
    expect(cards()[0]?.[1]).toBe(range(`9${NBSP}h${NBSP}00`, `12${NBSP}h${NBSP}00`));
    expect(document.activeElement).toBe(host.querySelector('article.card'));
  });

  it('« Supprimer » demande confirmation, supprime, puis met le focus à la carte suivante', async () => {
    const { button, dialogButton, http, settle, cards, host } = await render(
      conventionWith(['09:00', '11:30'], ['14:00', '16:30'], ['17:00', '19:30']),
    );

    button('Supprimer le créneau 2').click();
    await settle();
    expect(document.querySelector('[role="alertdialog"] h2')?.textContent).toBe(
      `Supprimer le créneau 2${THIN_NBSP}?`,
    );
    expect(document.activeElement).toBe(dialogButton('Annuler'));
    dialogButton('Supprimer le créneau').click();
    http
      .expectOne(apiUrl(timeSlotEndpoints.remove, { timeSlotId: 's-14:00' }))
      .flush(conventionWith(['09:00', '11:30'], ['17:00', '19:30']));
    await settle();

    expect(cards().map(([title]) => title)).toEqual(['Créneau 1', 'Créneau 2']);
    expect(document.activeElement).toBe(host.querySelectorAll('article.card')[1]);
  });

  it('« Annuler » dans la confirmation ne supprime rien, et rend le focus à « Supprimer »', async () => {
    const { button, dialogButton, http, settle, cards } = await render(
      conventionWith(['09:00', '11:30']),
    );
    const remove = button('Supprimer le créneau 1');
    remove.focus();

    remove.click();
    await settle();
    dialogButton('Annuler').click();
    await settle();

    http.expectNone(apiUrl(timeSlotEndpoints.remove, { timeSlotId: 's-09:00' }));
    expect(cards()).toHaveLength(1);
    expect(document.activeElement).toBe(remove);
  });
});
