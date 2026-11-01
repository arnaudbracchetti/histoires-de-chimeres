import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  apiUrl,
  signUpTrackingEndpoints,
  type SignUpTrackingDto,
  type TimeSlotTrackingDto,
} from '@chimeres/contract';
import { NBSP, THIN_NBSP } from '@chimeres/design';
import { SignUpTrackingPage } from './sign-up-tracking-page';

const timeSlot = (
  rank: number,
  start: string,
  end: string,
  figures: Partial<TimeSlotTrackingDto> = {},
): TimeSlotTrackingDto => ({
  id: `s${rank}`,
  rank,
  start,
  end,
  state: 'sign-ups-open',
  demand: 0,
  capacity: { min: 0, max: 0 },
  ...figures,
});

/** Créneau 1 publié ; créneau 2 ouvert, très demandé ; créneau 3 ouvert, sans inscription. */
const TRACKING: SignUpTrackingDto = {
  timeSlots: [
    timeSlot(1, '09:00', '11:30', {
      state: 'published',
      demand: 18,
      capacity: { min: 12, max: 20 },
    }),
    timeSlot(2, '13:00', '15:30', { demand: 26, capacity: { min: 14, max: 22 } }),
    timeSlot(3, '16:00', '18:30', { capacity: { min: 4, max: 4 } }),
  ],
  tables: [{ id: 't1', name: 'Dragon' }],
};

/** Le texte, un blanc entre deux nœuds, espaces normalisées : pour comparer sans les insécables. */
const text = (element: Element | null | undefined) => {
  const parts: string[] = [];
  if (element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '');
  }
  return parts
    .join(' ')
    .replaceAll(NBSP, ' ')
    .replaceAll(THIN_NBSP, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

describe('Pilotage du jour J', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render(tracking = TRACKING) {
    const fixture = TestBed.createComponent(SignUpTrackingPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(signUpTrackingEndpoints.read))
      .flush(tracking);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const tiles = () => [...host.querySelectorAll<HTMLButtonElement>('.strip button')];
    const summary = () => host.querySelector('.summary');
    return { fixture, host, tiles, summary };
  }

  it('titre la page, avec la ligne réservée à l’âge des chiffres, vide', async () => {
    const { host } = await render();

    expect(text(host.querySelector('h1'))).toBe('Pilotage du jour J');
    expect(text(host.querySelector('.freshness'))).toBe('');
  });

  it('montre une tuile par créneau, avec rang, plage, ratio et légende', async () => {
    const { tiles } = await render();

    expect(tiles()).toHaveLength(3);
    expect(text(tiles()[1])).toBe('Créneau 2 13 h 00 – 15 h 30 26 / 22 participants / places');
  });

  it('choisit à l’ouverture le premier créneau dont les inscriptions sont ouvertes', async () => {
    const { tiles, summary } = await render();

    expect(tiles().map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(text(summary()?.querySelector('h2'))).toBe('Créneau 2 · 13 h 00 – 15 h 30');
  });

  it('atténue la tuile d’un créneau fermé, avec son état et sans chiffres', async () => {
    const { tiles } = await render({
      ...TRACKING,
      timeSlots: [
        ...TRACKING.timeSlots,
        timeSlot(4, '19:00', '21:30', {
          state: 'drawing',
          demand: 3,
          capacity: { min: 3, max: 5 },
        }),
      ],
    });

    expect(tiles()[0]!.classList).toContain('closed');
    expect(text(tiles()[0])).toBe('Créneau 1 9 h 00 – 11 h 30 Tirage publié');
    expect(text(tiles()[3])).toBe('Créneau 4 19 h 00 – 21 h 30 Tirage en cours');
  });

  it('résume la demande et la capacité du créneau choisi', async () => {
    const { summary } = await render();

    expect(text(summary()?.querySelector('.figures'))).toBe('26 participants 14 à 22 places');
    // Le nombre et son nom ne se séparent pas en fin de ligne.
    expect(summary()?.querySelector('.figures')?.textContent).toContain(`26${NBSP}participants`);
  });

  it('écrit une seule borne quand les deux sont égales, et le texte sans inscription', async () => {
    const { fixture, tiles, summary } = await render();

    tiles()[2]!.click();
    fixture.detectChanges();

    expect(tiles()[2]!.getAttribute('aria-pressed')).toBe('true');
    expect(text(summary()?.querySelector('.figures'))).toBe('0 participant 4 places');
    expect(text(summary())).toContain("Aucune inscription sur ce créneau pour l'instant.");
  });

  it('dit qu’un créneau publié ne change plus', async () => {
    const { fixture, tiles, summary } = await render();

    tiles()[0]!.click();
    fixture.detectChanges();

    expect(text(summary())).toBe(
      'Créneau 1 · 9 h 00 – 11 h 30 Tirage publié : les inscriptions sont fermées et le programme du créneau ne change plus.',
    );
  });
});
