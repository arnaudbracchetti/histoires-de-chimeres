import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  linkedPhoneEndpoints,
  type LinkPhoneDto,
  type ProblemDto,
} from '@chimeres/contract';
import { LinkedPhone } from '../linked-phone';
import { PresenceCodeStore } from '../presence-code-store';
import { Alerts } from '../shell/alerts';
import { NBSP } from '../typography/french';
import { NicknamePage } from './nickname-page';

/** Le POST de « s'identifier » : le GET du pseudo relié a la même adresse. */
const LINK = { method: 'POST', url: apiUrl(linkedPhoneEndpoints.link) };

describe('NicknamePage', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('presenceCode', 'K7M2');
    TestBed.configureTestingModule({
      imports: [NicknamePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideLocationMocks()],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(NicknamePage);
    fixture.detectChanges();
    // Le téléphone n'est relié à aucun pseudo : c'est pourquoi l'écran s'affiche.
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'GET', url: apiUrl(linkedPhoneEndpoints.read) })
      .flush(
        { code: 'phone-not-linked', title: 'Téléphone relié à aucun pseudo' },
        { status: 401, statusText: 'Unauthorized' },
      );
    const page = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return {
      fixture,
      page,
      settle,
      input: () => page.querySelector('input')!,
      /** Tape le pseudo, puis envoie le formulaire. */
      async enter(nickname: string) {
        const input = page.querySelector('input')!;
        input.value = nickname;
        input.dispatchEvent(new Event('input'));
        page.querySelector('form')!.dispatchEvent(new Event('submit'));
        await settle();
      },
      async tap(name: string) {
        const button = [...page.querySelectorAll('button')].find(
          (candidate) => candidate.textContent?.trim() === name,
        );
        if (!button) throw new Error(`Aucun bouton « ${name} ».`);
        button.click();
        await settle();
      },
      heading: () => page.querySelector('h1')?.textContent?.trim(),
      error: () => page.querySelector('.error')?.textContent?.trim() ?? '',
    };
  }

  const http = () => TestBed.inject(HttpTestingController);
  const answer = (body: LinkPhoneDto) => http().expectOne(LINK).flush(body);
  const nickname = () => TestBed.inject(LinkedPhone).nickname();

  it('demande « Ton pseudo »', () => {
    const { heading, page } = render();

    expect(heading()).toBe('Ton pseudo');
    expect(page.querySelector('label')?.textContent?.trim()).toBe('Pseudo');
  });

  it('relie le téléphone à un pseudo nouveau, avec le code de présence gardé (ID-1)', async () => {
    const { enter, settle } = render();

    await enter('Élodie');
    const request = http().expectOne(LINK);
    expect(request.request.body).toEqual({
      presenceCode: 'K7M2',
      nickname: 'Élodie',
      confirmation: null,
    });
    request.flush({ status: 'linked', nickname: 'Élodie' } satisfies LinkPhoneDto);
    await settle();

    expect(nickname()).toBe('Élodie');
  });

  it.each([
    ['vide', '   ', 'Tape ton pseudo.'],
    [
      'de plus de 30 caractères',
      'a'.repeat(31),
      `Ton pseudo fait 30${NBSP}caractères au plus${NBSP}: raccourcis-le.`,
    ],
  ])('refuse un pseudo %s, sans rien envoyer', async (_, typed, message) => {
    const { enter, error, input } = render();

    await enter(typed);

    http().expectNone(LINK);
    expect(error()).toBe(message);
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  describe('pseudo existant', () => {
    async function confirmationOf(typed: string) {
      const rendered = render();
      await rendered.enter(typed);
      answer({ status: 'confirmation-needed', confirmation: 'participant', nickname: 'Élodie' });
      await rendered.settle();
      return rendered;
    }

    it('demande si c’est bien toi qui l’as créé, et renvoie vers un Organisateur (ID-1)', async () => {
      const { heading, page } = await confirmationOf('elodie');

      expect(heading()).toBe('Ce pseudo existe déjà');
      expect(page.querySelector('.nickname')?.textContent?.trim()).toBe('Élodie');
      expect(page.textContent).toContain(`Est-ce bien toi qui l'as créé${'\u202f'}?`);
      expect(page.textContent).toContain('plus tôt dans la journée, sur ce téléphone ou un autre');
      expect(page.textContent).toContain(`demande à un Organisateur, à l'accueil`);
      expect(nickname()).toBeNull();
    });

    it('relie le téléphone sur « Oui, c’est moi »', async () => {
      const { tap, settle } = await confirmationOf('elodie');

      await tap("Oui, c'est moi");
      const request = http().expectOne(LINK);
      expect(request.request.body).toEqual({
        presenceCode: 'K7M2',
        nickname: 'elodie',
        confirmation: 'participant',
      });
      request.flush({ status: 'linked', nickname: 'Élodie' } satisfies LinkPhoneDto);
      await settle();

      expect(nickname()).toBe('Élodie');
    });

    it('revient au champ du pseudo sur « Non, choisir un autre pseudo »', async () => {
      const { tap, heading, input } = await confirmationOf('elodie');

      await tap('Non, choisir un autre pseudo');

      http().expectNone(LINK);
      expect(heading()).toBe('Ton pseudo');
      expect(input().value).toBe('elodie');
    });
  });

  describe('pseudo d’un MJ (ID-3)', () => {
    async function confirmationOf(typed: string) {
      const rendered = render();
      await rendered.enter(typed);
      answer({ status: 'confirmation-needed', confirmation: 'game-master', nickname: 'Brann' });
      await rendered.settle();
      return rendered;
    }

    it('demande « Es-tu bien ce MJ ? », dit ce que le lien ouvre, et renvoie vers un Organisateur', async () => {
      const { heading, page } = await confirmationOf('brann');

      expect(heading()).toBe(`Es-tu bien ce MJ${'\u202f'}?`);
      expect(page.querySelector('.nickname')?.textContent?.trim()).toBe('Brann');
      expect(page.textContent).toContain('les parties que tu mènes');
      expect(page.textContent).toContain('leurs notifications');
      expect(page.textContent).toContain(`demande à un Organisateur, à l'accueil`);
      expect(nickname()).toBeNull();
    });

    it('relie le téléphone au MJ sur « Oui, c’est moi »', async () => {
      const { tap, settle } = await confirmationOf('brann');

      await tap("Oui, c'est moi");
      const request = http().expectOne(LINK);
      expect(request.request.body).toEqual({
        presenceCode: 'K7M2',
        nickname: 'brann',
        confirmation: 'game-master',
      });
      request.flush({ status: 'linked', nickname: 'Brann' } satisfies LinkPhoneDto);
      await settle();

      expect(nickname()).toBe('Brann');
    });

    it('revient au champ du pseudo sur « Non, choisir un autre pseudo »', async () => {
      const { tap, heading, input } = await confirmationOf('brann');

      await tap('Non, choisir un autre pseudo');

      http().expectNone(LINK);
      expect(heading()).toBe('Ton pseudo');
      expect(input().value).toBe('brann');
    });
  });

  it('redemande le code de présence quand l’API le refuse (ID-2)', async () => {
    const { enter, settle } = render();

    await enter('Élodie');
    http()
      .expectOne(LINK)
      .flush(
        {
          code: 'presence-code-wrong',
          title: 'Code incorrect',
          errors: [{ field: 'presenceCode', code: 'presence-code-wrong', message: 'Faux.' }],
        } satisfies Partial<ProblemDto>,
        { status: 422, statusText: 'Refusé' },
      );
    await settle();

    expect(TestBed.inject(PresenceCodeStore).code()).toBeNull();
    expect(TestBed.inject(Alerts).notices()).toMatchObject([{ title: 'Faux.' }]);
  });

  it('signale la fin de la convention', async () => {
    const { enter, settle, fixture } = render();
    let ended = false;
    fixture.componentInstance.ended.subscribe(() => (ended = true));

    await enter('Élodie');
    http().expectOne(LINK).flush(
      { code: 'convention-ended', title: 'La convention est terminée' },
      {
        status: 410,
        statusText: 'Gone',
      },
    );
    await settle();

    expect(ended).toBe(true);
  });
});
