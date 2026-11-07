import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { FrontOfficeTimeSlotDto } from '@chimeres/contract';
import { AppInstallation } from '../installation/app-installation';
import { ParticipantData, type Home, type MyTimeSlot } from '../participant-data/participant-data';
import { HomePage } from './home-page';

const timeSlot: FrontOfficeTimeSlotDto = { id: 's2', rank: 2, start: '14:00', end: '18:30' };

/** Le créneau 2 de « Ton programme », sans inscription du pseudo. */
const programmeLine = (given: Partial<MyTimeSlot>): MyTimeSlot => ({
  timeSlot,
  state: 'sign-ups-open',
  signedUpGames: [],
  backupGames: [],
  withoutGame: false,
  assignment: null,
  onlySignUpOversubscribed: false,
  led: null,
  ...given,
});

describe('HomePage', () => {
  /** La page, avec ce créneau dans « Ton programme ». */
  async function render(slot: MyTimeSlot): Promise<HTMLElement> {
    const home: Home = { card: { kind: 'choose-games' }, timeSlots: [slot] };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ParticipantData, useValue: { home: signal(home) } },
        { provide: AppInstallation, useValue: { advice: signal(null), offered: signal(false) } },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** Le libellé et le détail de la ligne. */
  const lineOf = (page: HTMLElement) =>
    ['.title', '.meta'].map((selector) =>
      page.querySelector(`.programme .status ${selector}`)?.textContent?.trim(),
    );

  it('dit « Sans partie » sur la ligne d’un créneau où le pseudo est sans partie (IN-6)', async () => {
    const page = await render(programmeLine({ withoutGame: true }));

    expect(lineOf(page)).toEqual(['Sans partie', 'Inscris-toi à une autre partie']);
  });

  it('dit « Aucune inscription » sinon', async () => {
    const page = await render(programmeLine({}));

    expect(lineOf(page)).toEqual(['Aucune inscription', 'Choisir une partie']);
  });
});
