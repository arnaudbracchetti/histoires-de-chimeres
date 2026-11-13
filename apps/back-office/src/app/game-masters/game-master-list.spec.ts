import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  apiUrl,
  conventionEndpoints,
  gameMasterEndpoints,
  type GameMasterDto,
  type ProblemDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { GameMasterList } from './game-master-list';

/** Les MJ, dans l'ordre donné : celui que renvoie l'API. */
const gameMasters = (...nicknames: string[]): GameMasterDto[] =>
  nicknames.map((nickname) => ({
    id: `g-${nickname}`,
    nickname,
    availabilities: [],
    scenarios: [],
    games: [],
  }));

describe('GameMasterList', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  async function render(list = gameMasters(), timeSlots: TimeSlotDto[] = []) {
    const fixture = TestBed.createComponent(GameMasterList);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(gameMasterEndpoints.list)).flush(list);
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
    return {
      host,
      http,
      settle,
      text,
      nicknames,
      newRow,
      input,
      filter,
      type,
      press,
      button,
      errorText,
    };
  }

  it('montre une ligne par MJ, dans l’ordre de l’API, chacune liée à sa fiche', async () => {
    const { host, nicknames } = await render(gameMasters('Élodie', 'Kaïros'));

    expect(nicknames()).toEqual(['Élodie', 'Kaïros']);
    expect(host.querySelector('tbody th a')?.getAttribute('href')).toBe('/mj/g-%C3%89lodie');
  });

  it('montre les disponibilités en pastilles, une par créneau, et les dit aux lecteurs d’écran', async () => {
    const { host, text } = await render(
      [
        { id: 'g1', nickname: 'Élodie', availabilities: ['s1', 's3'], scenarios: [], games: [] },
        { id: 'g2', nickname: 'Kaïros', availabilities: [], scenarios: [], games: [] },
      ],
      [
        { id: 's1', rank: 1, start: '09:00', end: '11:30', availabilityCount: 1 },
        { id: 's2', rank: 2, start: '14:00', end: '16:30', availabilityCount: 0 },
        { id: 's3', rank: 3, start: '17:00', end: '19:30', availabilityCount: 1 },
      ],
    );

    const cells = [...host.querySelectorAll('tbody td.availabilities')];
    const pips = (cell: Element) =>
      [...cell.querySelectorAll('app-pip')].map(
        (pip) => `${text(pip)}${pip.classList.contains('solid') ? '✓' : ''}`,
      );
    expect(cells.map(pips)).toEqual([
      ['1✓', '2', '3✓'],
      ['1', '2', '3'],
    ]);
    expect(cells.map((cell) => text(cell.querySelector('.visually-hidden')))).toEqual([
      'créneaux 1 et 3',
      'Aucune',
    ]);
  });

  it('montre le nombre de scénarios de chaque MJ', async () => {
    const scenario = {
      id: 's1',
      title: 'Zénith',
      system: 'Alien',
      seats: { min: 3, max: 5 },
      duration: 1 as const,
      imageUrl: null,
    };
    const { host, text } = await render([
      {
        id: 'g1',
        nickname: 'Élodie',
        availabilities: [],
        scenarios: [scenario, { ...scenario, id: 's2' }],
        games: [],
      },
      { id: 'g2', nickname: 'Kaïros', availabilities: [], scenarios: [], games: [] },
    ]);

    expect([...host.querySelectorAll('tbody td.scenarios')].map(text)).toEqual(['2', '0']);
  });

  it('montre le nombre de parties que mène chaque MJ : une partie double compte une fois', async () => {
    const game = (gameId: string, timeSlotId: string) => ({
      gameId,
      timeSlotId,
      table: { id: 't1', name: 'Table 1' },
      scenario: { id: 'sc1', title: 'Néons' },
    });
    const { host, text } = await render([
      {
        id: 'g1',
        nickname: 'Élodie',
        availabilities: ['s1', 's2', 's3'],
        scenarios: [],
        games: [game('p1', 's1'), game('p2', 's2'), game('p2', 's3')],
      },
      { id: 'g2', nickname: 'Kaïros', availabilities: [], scenarios: [], games: [] },
    ]);

    expect([...host.querySelectorAll('thead th')].map(text)).toContain('Parties');
    expect([...host.querySelectorAll('tbody td.games')].map(text)).toEqual(['2', '0']);
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
    const { host, button, settle } = await render();

    expect(host.querySelector('.empty use')?.getAttribute('href')).toBe(
      'illustration.svg#engraving',
    );
    expect(host.querySelector('table')).toBeNull();
    button('Créer le premier MJ')!.click();
    await settle();

    expect(document.querySelector('app-participant-creation')).not.toBeNull();
  });

  it('« Ajouter un MJ » ouvre l’assistant « Créer un pseudo », MJ coché, puis relit la liste', async () => {
    const { button, settle, http, nicknames } = await render(gameMasters('Kaïros'));

    /** Le dialogue ouvert, `whenStable()` attendrait sa fermeture. */
    const tick = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve));
    };
    button('Ajouter un MJ')!.click();
    await tick();
    const wizard = document.querySelector<HTMLElement>('app-participant-creation')!;
    const input = wizard.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = 'Élodie';
    input.dispatchEvent(new Event('input'));
    await tick();
    [...wizard.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Suivant')!
      .click();
    await tick();
    expect(
      wizard.querySelector<HTMLInputElement>('app-role-card[role="game-master"] input')!.checked,
    ).toBe(true);
    [...wizard.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Annuler')!
      .click();
    await tick();

    http.expectOne(apiUrl(gameMasterEndpoints.list)).flush(gameMasters('Élodie', 'Kaïros'));
    await settle();
    expect(nicknames()).toEqual(['Élodie', 'Kaïros']);
  });
});
