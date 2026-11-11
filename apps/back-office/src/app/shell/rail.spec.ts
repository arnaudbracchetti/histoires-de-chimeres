import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  accountEndpoints,
  apiUrl,
  conventionEndpoints,
  type ConnectedAccountDto,
} from '@chimeres/contract';
import { Rail } from './rail';

const KAIROS: ConnectedAccountDto = {
  nickname: 'Kaïros',
  participantId: 'p-kairos',
  organizer: true,
  gameMasterId: null,
};

describe('Rail', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  /** Le rail, avec le compte connecté donné, ou sans session (401). */
  function render(account: ConnectedAccountDto | null = KAIROS) {
    const fixture = TestBed.createComponent(Rail);
    fixture.detectChanges();
    // Le compte est lu une fois, par un store partagé : seul le premier rendu d'un test l'attend.
    for (const request of TestBed.inject(HttpTestingController).match(
      apiUrl(accountEndpoints.read),
    )) {
      if (account) request.flush(account);
      else request.flush(null, { status: 401, statusText: 'Unauthorized' });
    }
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const toggle = () => host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    /** Sert la convention, puis attend que le rail soit stable. */
    const settle = async () => {
      TestBed.inject(HttpTestingController)
        .expectOne(apiUrl(conventionEndpoints.read))
        .flush({ id: 'c1', name: 'Histoires de Chimères 2027', date: null });
      await fixture.whenStable();
    };
    return { fixture, host, toggle, settle };
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
    expect(links).toEqual([
      'Calendrier',
      'MJ',
      'Scénarios',
      'Créneaux et tables',
      'Pilotage du jour J',
      'Participants',
      'Informations de connexion',
    ]);
  });

  it('mène au Pilotage du jour J, aux Participants et aux Informations de connexion', () => {
    const { host } = render();

    const findHrefOfEntry = (label: string) =>
      [...host.querySelectorAll<HTMLAnchorElement>('nav a')]
        .find((a) => a.textContent?.trim() === label)
        ?.getAttribute('href');
    expect(findHrefOfEntry('Pilotage du jour J')).toBe('/pilotage');
    expect(findHrefOfEntry('Participants')).toBe('/participants');
    expect(findHrefOfEntry('Informations de connexion')).toBe('/informations-de-connexion');
  });

  it('affiche la convention en cours, date à fixer', async () => {
    const { fixture, host } = render();

    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(conventionEndpoints.read))
      .flush({ id: 'c1', name: 'Histoires de Chimères 2027', date: null });
    await fixture.whenStable();

    const convention = host.querySelector<HTMLAnchorElement>('a.convention')!;
    expect(convention.textContent).toContain('Histoires de Chimères 2027');
    expect(convention.textContent).toContain('date à fixer');
    expect(convention.getAttribute('href')).toBe('/creneaux-et-tables');
  });

  it('affiche la date de la convention en toutes lettres', async () => {
    const { fixture, host } = render();

    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(conventionEndpoints.read))
      .flush({ id: 'c1', name: 'Histoires de Chimères 2027', date: '2027-03-13' });
    await fixture.whenStable();

    expect(host.querySelector('a.convention')?.textContent).toContain('samedi 13 mars 2027');
  });

  it('montre en bas le pseudo de la personne connectée, qui mène à « Mon compte », et « Se déconnecter »', async () => {
    const { host, settle } = render();
    await settle();

    const footer = host.querySelector('.footer')!;
    const user = footer.querySelector<HTMLAnchorElement>('a.user')!;
    expect(user.textContent?.trim()).toBe('Kaïros');
    expect(user.getAttribute('href')).toBe('/mon-compte');
    expect(footer.querySelector('button.log-out')?.textContent?.trim()).toBe('Se déconnecter');
  });

  it('sans session, propose « Se connecter »', async () => {
    const { host, settle } = render(null);
    await settle();

    const link = host.querySelector<HTMLAnchorElement>('.footer a')!;
    expect(link.textContent?.trim()).toBe('Se connecter');
    expect(link.getAttribute('href')).toBe('/connexion');
    expect(host.querySelector('.footer .user')).toBeNull();
  });

  it('« Se déconnecter » supprime la session, puis propose « Se connecter »', async () => {
    const { fixture, host, settle } = render();
    await settle();

    host.querySelector<HTMLButtonElement>('button.log-out')!.click();
    const logOut = TestBed.inject(HttpTestingController).expectOne(apiUrl(accountEndpoints.logOut));
    expect(logOut.request.method).toBe('DELETE');
    logOut.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.querySelector('.footer a')?.textContent?.trim()).toBe('Se connecter');
  });
});
