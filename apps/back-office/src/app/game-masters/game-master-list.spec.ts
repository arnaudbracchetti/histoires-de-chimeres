import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  apiUrl,
  gameMasterEndpoints,
  type GameMasterDto,
  type ProblemDto,
} from '@chimeres/contract';
import { GameMasterList } from './game-master-list';

// Espace insécable de docs/design/ton.md.
const NBSP = ' ';

/** Les MJ, dans l'ordre donné : celui que renvoie l'API. */
const gameMasters = (...nicknames: string[]): GameMasterDto[] =>
  nicknames.map((nickname) => ({ id: `g-${nickname}`, nickname }));

describe('GameMasterList', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  async function render(list = gameMasters()) {
    const fixture = TestBed.createComponent(GameMasterList);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(gameMasterEndpoints.list)).flush(list);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    /** Les pseudos affichés, dans l'ordre du tableau. */
    const nicknames = () => [...host.querySelectorAll('tbody th a')].map(text);
    const newRow = () => host.querySelector<HTMLElement>('tr.new');
    const input = () => newRow()!.querySelector('input')!;
    const filter = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
    const type = async (field: HTMLInputElement, value: string) => {
      field.value = value;
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    const press = async (key: 'Enter' | 'Escape') => {
      (document.activeElement ?? input()).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
      await settle();
    };
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find(
        (b) => (b.getAttribute('aria-label') ?? text(b)) === name,
      );
    const errorText = () => {
      const ids = input().getAttribute('aria-describedby')?.split(' ') ?? [];
      return ids.map((id) => text(host.querySelector(`#${id}`))).find(Boolean);
    };
    return { host, http, settle, text, nicknames, newRow, input, filter, type, press, button, errorText };
  }

  it('montre une ligne par MJ, dans l’ordre de l’API, chacune liée à sa fiche', async () => {
    const { host, nicknames } = await render(gameMasters('Élodie', 'Kaïros'));

    expect(nicknames()).toEqual(['Élodie', 'Kaïros']);
    expect(host.querySelector('tbody th a')?.getAttribute('href')).toBe('/mj/g-%C3%89lodie');
  });

  it('trie par pseudo, dans un sens puis dans l’autre, et l’indique par aria-sort', async () => {
    const { host, nicknames, button, settle } = await render(
      gameMasters('Alix', 'Brune', 'Céleste'),
    );
    const header = host.querySelector('thead th')!;
    expect(header.getAttribute('aria-sort')).toBe('ascending');

    button('Pseudo')!.click();
    await settle();

    expect(header.getAttribute('aria-sort')).toBe('descending');
    expect(nicknames()).toEqual(['Céleste', 'Brune', 'Alix']);
  });

  it('filtre sans tenir compte de la casse ni des accents', async () => {
    const { nicknames, filter, type } = await render(gameMasters('Élodie', 'Kaïros', 'Mélodie'));

    await type(filter(), 'ELOD');

    expect(nicknames()).toEqual(['Élodie', 'Mélodie']);
  });

  it('filtre sans résultat : « Aucun MJ ne correspond », et « Effacer le filtre »', async () => {
    const { host, nicknames, filter, type, button, settle, text } = await render(
      gameMasters('Élodie', 'Kaïros'),
    );

    await type(filter(), 'Zorglub');
    expect(text(host.querySelector('tbody'))).toContain('Aucun MJ ne correspond');
    button('Effacer le filtre')!.click();
    await settle();

    expect(nicknames()).toEqual(['Élodie', 'Kaïros']);
    expect(document.activeElement).toBe(filter());
  });

  it('sans MJ, montre l’état vide gravé, qui invite à créer le premier', async () => {
    const { host, button, settle, newRow, input } = await render();

    expect(host.querySelector('.empty use')?.getAttribute('href')).toBe(
      'illustration.svg#engraving',
    );
    expect(host.querySelector('table')).toBeNull();
    button('Créer le premier MJ')!.click();
    await settle();

    expect(newRow()).not.toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it('crée à la chaîne : après l’ajout, une nouvelle ligne vide s’ouvre', async () => {
    const { button, type, input, http, settle, nicknames } = await render(gameMasters('Kaïros'));

    button('Ajouter un MJ')!.click();
    await settle();
    expect(document.activeElement).toBe(input());
    await type(input(), '  Élodie ');
    button('Ajouter')!.click();
    await settle();
    const request = http.expectOne(apiUrl(gameMasterEndpoints.add));
    expect(request.request.body).toEqual({ nickname: 'Élodie' });
    request.flush(gameMasters('Élodie', 'Kaïros'));
    await settle();

    expect(nicknames()).toEqual(['Élodie', 'Kaïros']);
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
    expect(button('Ajouter un MJ')).toBeUndefined();
  });

  it('Entrée enregistre, Échap ferme la ligne et rend le focus à « Ajouter un MJ »', async () => {
    const { button, type, input, press, http, settle, newRow } = await render(
      gameMasters('Kaïros'),
    );
    button('Ajouter un MJ')!.click();
    await settle();

    await type(input(), 'Élodie');
    await press('Enter');
    http.expectOne(apiUrl(gameMasterEndpoints.add)).flush(gameMasters('Élodie', 'Kaïros'));
    await settle();
    await press('Escape');

    expect(newRow()).toBeNull();
    expect(document.activeElement).toBe(button('Ajouter un MJ'));
  });

  it('un pseudo vide n’est signalé qu’à l’enregistrement, sans rien envoyer', async () => {
    const { button, type, input, press, http, settle, errorText } = await render(
      gameMasters('Kaïros'),
    );
    button('Ajouter un MJ')!.click();
    await settle();

    await type(input(), '  ');
    expect(errorText()).toBeUndefined();
    await press('Enter');

    http.expectNone(apiUrl(gameMasterEndpoints.add));
    expect(errorText()).toBe('Donne un pseudo au MJ.');
  });

  it('signale un pseudo trop long dès qu’on quitte le champ', async () => {
    const { button, type, input, settle, errorText } = await render(gameMasters('Kaïros'));
    button('Ajouter un MJ')!.click();
    await settle();

    await type(input(), 'a'.repeat(31));

    expect(errorText()).toBe(`Un pseudo fait 30${NBSP}caractères au plus${NBSP}: raccourcis-le.`);
  });

  it('affiche dans la ligne un pseudo pris refusé par l’API, sans perdre la saisie', async () => {
    const { button, type, input, press, http, settle, errorText } = await render(
      gameMasters('Élodie'),
    );
    const message = `Le MJ «${NBSP}Élodie${NBSP}» porte déjà ce pseudo${NBSP}: choisis-en un autre.`;
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:nickname-taken',
      title: 'Pseudo déjà pris',
      status: 422,
      detail: message,
      code: 'nickname-taken',
      errors: [{ field: 'nickname', code: 'nickname-taken', message }],
    };
    button('Ajouter un MJ')!.click();
    await settle();

    await type(input(), 'elodie');
    await press('Enter');
    http
      .expectOne(apiUrl(gameMasterEndpoints.add))
      .flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(errorText()).toBe(message);
    expect(input().value).toBe('elodie');
    expect(document.activeElement).toBe(input());
  });
});
