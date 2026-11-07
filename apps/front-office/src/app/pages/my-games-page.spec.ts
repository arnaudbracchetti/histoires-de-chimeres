import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { FrontOfficeGameDto, FrontOfficeScheduleDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { ParticipantData, type MyTimeSlot } from '../participant-data/participant-data';
import { MyGamesPage } from './my-games-page';

const schedule: FrontOfficeScheduleDto = {
  date: '2027-03-14',
  timeSlots: [{ id: 's2', rank: 2, start: '14:00', end: '18:30' }],
  games: [],
  end: { date: '2027-03-14', time: '18:30' },
};

/** Le créneau 2, sans inscription du pseudo. */
const timeSlot = (given: Partial<MyTimeSlot>): MyTimeSlot => ({
  timeSlot: schedule.timeSlots[0]!,
  state: 'sign-ups-open',
  signedUpGames: [],
  backupGames: [],
  withoutGame: false,
  assignment: null,
  onlySignUpOversubscribed: false,
  led: null,
  ...given,
});

describe('MyGamesPage', () => {
  const withdrawFromDraw = vi.fn(async () => undefined);

  /** La page, avec ce créneau dans Mes parties. */
  async function render(slot: MyTimeSlot): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ParticipantData,
          useValue: {
            schedule: signal(schedule),
            myTimeSlots: signal([slot]),
            withdrawFromDraw,
            isWithdrawingFromDraw: () => false,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MyGamesPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** Le texte, ses blancs de mise en page réduits ; les espaces insécables restent. */
  const text = (element: Element | null) => element?.textContent?.replace(/[ \n\t]+/g, ' ').trim();
  const withdrawButton = (page: HTMLElement) =>
    [...page.querySelectorAll('button')].find((button) => text(button) === 'Me retirer du tirage');

  beforeEach(() => withdrawFromDraw.mockClear());

  it('dit au pseudo sans partie qu’il reste dans le tirage, à la place de « Aucune inscription » (IN-6)', async () => {
    const page = await render(timeSlot({ withoutGame: true }));

    expect(text(page.querySelector('section'))).toContain(
      `Toutes tes parties ont été retirées de ce créneau. Tu restes dans le tirage du créneau 2${NBSP}: inscris-toi à une autre partie pour avoir une table.`,
    );
    expect(text(page.querySelector('section'))).not.toContain('Aucune inscription');
  });

  it('groupe sous sa partie menée ses inscriptions de secours, « En secours » (IN-4, §5.7)', async () => {
    const game = (id: string, title: string): FrontOfficeGameDto => ({
      id,
      timeSlotIds: ['s2'],
      tableName: 'Griffon',
      title,
      system: 'Cthulhu',
      gameMasterNickname: 'Brann',
      imageUrl: null,
      presentation: '',
      contentWarnings: '',
      seats: { min: 3, max: 5 },
      signUpCount: 2,
      playerCount: null,
      oversubscribed: false,
    });
    const page = await render(
      timeSlot({
        led: { game: game('neons', 'Néons'), started: false, outcome: { kind: 'sign-ups-open' } },
        backupGames: [game('brumes', 'Brumes')],
      }),
    );

    const backup = page.querySelector('[aria-labelledby="backup-2"]');
    expect(text(backup?.querySelector('h3') ?? null)).toBe('En secours');
    expect(text(backup?.querySelector('p') ?? null)).toBe(
      'Elles ne comptent que si ta partie est annulée.',
    );
    expect(text(backup?.querySelector('ul a') ?? null)).toContain('Brumes');
  });

  it('le retire du tirage d’un tap, sans confirmation', async () => {
    const page = await render(timeSlot({ withoutGame: true }));

    withdrawButton(page)!.click();

    expect(withdrawFromDraw).toHaveBeenCalledWith('s2');
  });
});
