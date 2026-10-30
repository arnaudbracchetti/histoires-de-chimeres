import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl, linkedPhoneEndpoints } from '@chimeres/contract';
import { LinkedPhone } from './linked-phone';
import { OfflineCopy } from './offline-copy';

describe('LinkedPhone', () => {
  const forget = vi.fn(async () => undefined);

  beforeEach(() => {
    forget.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OfflineCopy, useValue: { forget } },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const http = () => TestBed.inject(HttpTestingController);
  const url = apiUrl(linkedPhoneEndpoints.read);

  /** Le téléphone, après la lecture de son lien à l'ouverture. */
  async function opened(nickname: string | null): Promise<LinkedPhone> {
    const linkedPhone = TestBed.inject(LinkedPhone);
    TestBed.tick();
    const request = http().expectOne({ method: 'GET', url });
    if (nickname) request.flush({ nickname });
    else {
      request.flush(
        {
          code: 'phone-not-linked',
          title: 'Ce téléphone n’est relié à aucun pseudo.',
          status: 401,
        },
        { status: 401, statusText: 'Unauthorized' },
      );
    }
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    return linkedPhone;
  }

  it('garde la copie hors ligne d’un téléphone relié', async () => {
    const linkedPhone = await opened('Élodie');

    expect(linkedPhone.nickname()).toBe('Élodie');
    expect(forget).not.toHaveBeenCalled();
  });

  it('oublie la copie hors ligne d’un téléphone relié à aucun pseudo à l’ouverture (ID-8)', async () => {
    const linkedPhone = await opened(null);

    expect(linkedPhone.nickname()).toBeNull();
    expect(forget).toHaveBeenCalled();
  });

  it('oublie la copie hors ligne au changement de pseudo (ID-9)', async () => {
    const linkedPhone = await opened('Élodie');

    const unlinking = linkedPhone.unlink();
    http().expectOne({ method: 'DELETE', url }).flush(null);
    await unlinking;
    TestBed.tick();

    expect(linkedPhone.nickname()).toBeNull();
    expect(forget).toHaveBeenCalled();
  });

  it('oublie la copie hors ligne quand le lien est coupé (ID-8)', async () => {
    const linkedPhone = await opened('Élodie');

    linkedPhone.unlinkedByServer();
    TestBed.tick();

    expect(linkedPhone.nickname()).toBeNull();
    expect(forget).toHaveBeenCalled();
  });

  it('relit son lien une fois relié, pour que le service worker en garde la copie', async () => {
    const linkedPhone = await opened(null);

    linkedPhone.linked('Élodie');
    TestBed.tick();
    http().expectOne({ method: 'GET', url }).flush({ nickname: 'Élodie' });

    expect(linkedPhone.nickname()).toBe('Élodie');
  });
});
