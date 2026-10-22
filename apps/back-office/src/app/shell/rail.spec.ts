import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiUrl, conventionEndpoints } from '@chimeres/contract';
import { Rail } from './rail';

describe('Rail', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function render() {
    const fixture = TestBed.createComponent(Rail);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const toggle = () => host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    return { fixture, host, toggle };
  }

  it('est déplié par défaut', () => {
    const { toggle } = render();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Replier le rail');
  });

  it('reste replié au chargement suivant', () => {
    const first = render();
    first.toggle().click();
    first.fixture.detectChanges();
    expect(first.toggle().getAttribute('aria-expanded')).toBe('false');
    first.fixture.destroy();

    const second = render();

    expect(second.toggle().getAttribute('aria-expanded')).toBe('false');
    expect(second.toggle().getAttribute('aria-label')).toBe('Déplier le rail');
  });

  it('se déplie par défaut si le navigateur refuse le stockage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError');
    });
    const { fixture, toggle } = render();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('replié, chaque entrée garde son libellé', () => {
    const { fixture, host, toggle } = render();
    toggle().click();
    fixture.detectChanges();

    const links = [...host.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(links).toEqual(['Calendrier', 'MJ', 'Scénarios', 'Créneaux et tables']);
  });

  it('affiche la convention en cours, date à fixer', async () => {
    const { fixture, host } = render();

    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(conventionEndpoints.read))
      .flush({ id: 'c1', name: 'Histoires de Chimères 2027' });
    await fixture.whenStable();

    const convention = host.querySelector<HTMLAnchorElement>('a.convention')!;
    expect(convention.textContent).toContain('Histoires de Chimères 2027');
    expect(convention.textContent).toContain('date à fixer');
    expect(convention.getAttribute('href')).toBe('/creneaux-et-tables');
  });
});
