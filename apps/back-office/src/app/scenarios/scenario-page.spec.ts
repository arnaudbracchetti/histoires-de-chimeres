import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  accountEndpoints,
  apiUrl,
  scenarioEndpoints,
  type ConnectedAccountDto,
  type ScenarioDto,
} from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { ScenarioPage } from './scenario-page';

/** Élodie, MJ seule : son MJ est g-elodie. */
const ELODIE: ConnectedAccountDto = {
  participantId: 'p-elodie',
  nickname: 'Élodie',
  organizer: false,
  gameMasterId: 'g-elodie',
};

const TOUR: ScenarioDto = {
  id: 's1',
  title: "La Tour d'ébène",
  system: "L'Appel de Cthulhu",
  seats: { min: 3, max: 5 },
  duration: 2,
  imageUrl: null,
  gameMaster: { id: 'g-margot', nickname: 'Margot' },
  presentation: 'Une **tour** au bord du monde.',
  contentWarnings: 'Araignées',
};

describe('ScenarioPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  async function render(scenario: ScenarioDto, account: ConnectedAccountDto = ELODIE) {
    const fixture = TestBed.createComponent(ScenarioPage);
    fixture.componentRef.setInput('id', scenario.id);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(accountEndpoints.read)).flush(account);
    http.expectOne(apiUrl(scenarioEndpoints.read, { scenarioId: scenario.id })).flush(scenario);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    return { host, text };
  }

  it("le scénario d'un autre MJ se lit, sans geste d'écriture ni lien vers la fiche de son MJ", async () => {
    const { host, text } = await render(TOUR);

    expect(text(host.querySelector('h1'))).toBe("La Tour d'ébène");
    expect(host.querySelector('form, input, textarea')).toBeNull();
    expect(host.querySelector('app-more-menu')).toBeNull();
    expect(host.querySelector('app-scenario-image button')).toBeNull();
    expect(text(host.querySelector('.game-master'))).toBe('Proposé par Margot');
    expect(host.querySelector('.game-master a')).toBeNull();
    const reading = text(host.querySelector('.reading'));
    expect(reading).toContain("L'Appel de Cthulhu");
    expect(reading).toContain(`3 à 5${NBSP}places`);
    expect(reading).toContain(`2${NBSP}créneaux`);
    expect(reading).toContain('Araignées');
    expect(host.querySelector('.reading .presentation strong')?.textContent).toBe('tour');
  });

  it('son propre scénario se modifie, et son MJ mène à Ma fiche', async () => {
    const { host } = await render({
      ...TOUR,
      gameMaster: { id: 'g-elodie', nickname: 'Élodie' },
    });

    expect(host.querySelector('app-scenario-form form')).not.toBeNull();
    expect(host.querySelector('app-more-menu')).not.toBeNull();
    expect(host.querySelector('.game-master a')!.getAttribute('href')).toBe('/ma-fiche');
  });
});
