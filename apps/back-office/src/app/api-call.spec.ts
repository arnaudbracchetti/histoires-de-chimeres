import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { endpoint } from '@chimeres/contract';
import { injectApiCall } from './api-call';
import { apiResource } from './api-resource';

describe('Descripteurs à paramètres de chemin', () => {
  const update = endpoint<string, { timeSlotId: string }, { start: string }>(
    'PUT',
    'time-slots/:timeSlotId',
  );
  const read = endpoint<string, { timeSlotId: string }>('GET', 'time-slots/:timeSlotId');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('apiCall() écrit vers l’URL du descripteur, paramètres encodés', async () => {
    const apiCall = TestBed.runInInjectionContext(() => injectApiCall());
    const http = TestBed.inject(HttpTestingController);

    const response = apiCall(update, { params: { timeSlotId: 'a/b' }, body: { start: '09:00' } });
    const request = http.expectOne('/api/time-slots/a%2Fb');
    request.flush('ok');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ start: '09:00' });
    expect(await response).toBe('ok');
  });

  it('apiResource() relit quand ses paramètres changent', async () => {
    const http = TestBed.inject(HttpTestingController);
    const timeSlotId = signal('s1');
    const resource = runInInjectionContext(TestBed.inject(Injector), () =>
      apiResource(read, () => ({ timeSlotId: timeSlotId() })),
    );

    TestBed.tick();
    http.expectOne('/api/time-slots/s1').flush('premier');
    timeSlotId.set('s2');
    TestBed.tick();
    http.expectOne('/api/time-slots/s2').flush('second');
    await TestBed.inject(ApplicationRef).whenStable();

    expect(resource.value()).toBe('second');
  });
});
