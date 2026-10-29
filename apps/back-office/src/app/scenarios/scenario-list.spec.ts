import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiUrl, scenarioEndpoints, type ScenarioListItemDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { ScenarioList } from './scenario-list';

const aScenario = (
  id: string,
  title: string,
  system: string,
  nickname: string,
  changes: Partial<ScenarioListItemDto> = {},
): ScenarioListItemDto => ({
  id,
  title,
  system,
  seats: { min: 3, max: 5 },
  duration: 1,
  imageUrl: null,
  gameMaster: { id: `g-${id}`, nickname },
  games: 0,
  ...changes,
});

/** Dans l'ordre naturel des titres, celui que renvoie l'API. */
const SCENARIOS = [
  aScenario('s1', 'Scénario 2', 'Pendragon', 'Kaïros', { duration: 2, seats: { min: 4, max: 4 } }),
  aScenario('s2', 'Scénario 10', "L'Appel de Cthulhu", 'Élodie'),
  aScenario('s3', 'Zénith', 'Alien', 'Margot'),
];

describe('ScenarioList', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  async function render(list: ScenarioListItemDto[] = SCENARIOS) {
    const fixture = TestBed.createComponent(ScenarioList);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(scenarioEndpoints.list)).flush(list);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    /** Les titres affichés, dans l'ordre du tableau. */
    const titles = () => [...host.querySelectorAll('tbody th a')].map(text);
    const filter = async (value: string) => {
      const field = host.querySelector<HTMLInputElement>('input[type="search"]')!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const button = (name: string) =>
      [...host.querySelectorAll('button, a')].find((b) => text(b) === name) as
        HTMLElement | undefined;
    const sortBy = async (column: string) => {
      button(column)!.click();
      await fixture.whenStable();
    };
    const sortOf = (column: string) => button(column)!.closest('th')!.getAttribute('aria-sort');
    return { host, text, titles, filter, button, sortBy, sortOf, fixture };
  }

  it('montre chaque scénario : vignette, titre vers sa page, jeu, MJ, places, durée, parties', async () => {
    const { host, text } = await render();

    const cells = [...host.querySelectorAll('tbody tr')[0]!.children].map(text);
    // La vignette, sans image, montre la lettrine du titre.
    expect(cells).toEqual([
      'S',
      'Scénario 2',
      'Pendragon',
      'Kaïros',
      `4${NBSP}places`,
      `2${NBSP}créneaux`,
      '0',
    ]);
    const row = host.querySelector('tbody tr')!;
    expect(row.querySelector('app-scenario-illustration')).not.toBeNull();
    expect(row.querySelector('th a')!.getAttribute('href')).toBe('/scenarios/s1');
    expect(row.querySelector('td a')!.getAttribute('href')).toBe('/mj/g-s1');
  });

  it('trie par titre dans l’ordre naturel, puis à l’envers', async () => {
    const { titles, sortBy, sortOf } = await render();

    expect(titles()).toEqual(['Scénario 2', 'Scénario 10', 'Zénith']);
    expect(sortOf('Titre')).toBe('ascending');
    await sortBy('Titre');
    expect(titles()).toEqual(['Zénith', 'Scénario 10', 'Scénario 2']);
    expect(sortOf('Titre')).toBe('descending');
  });

  it('trie par jeu, puis par MJ', async () => {
    const { titles, sortBy, sortOf } = await render();

    await sortBy('Jeu');
    expect(titles()).toEqual(['Zénith', 'Scénario 10', 'Scénario 2']);
    expect(sortOf('Jeu')).toBe('ascending');
    expect(sortOf('Titre')).toBeNull();

    await sortBy('MJ');
    expect(titles()).toEqual(['Scénario 10', 'Scénario 2', 'Zénith']);
  });

  it('filtre sur le titre, le jeu et le MJ, sans casse ni accent', async () => {
    const { titles, filter } = await render();

    await filter('zenith');
    expect(titles()).toEqual(['Zénith']);
    await filter('cthulhu');
    expect(titles()).toEqual(['Scénario 10']);
    await filter('KAIROS');
    expect(titles()).toEqual(['Scénario 2']);
  });

  it('un filtre sans résultat le dit, et s’efface', async () => {
    const { host, text, titles, filter, button, fixture } = await render();

    await filter('rien');
    expect(text(host.querySelector('.none'))).toContain('Aucun scénario ne correspond');
    button('Effacer le filtre')!.click();
    await fixture.whenStable();
    expect(titles()).toHaveLength(3);
  });

  it('sans scénario, un état vide renvoie vers les MJ', async () => {
    const { host, text } = await render([]);

    expect(host.querySelector('table')).toBeNull();
    expect(text(host.querySelector('.empty p'))).toContain('Aucun scénario');
    expect(host.querySelector('.empty a')!.getAttribute('href')).toBe('/mj');
  });
});
