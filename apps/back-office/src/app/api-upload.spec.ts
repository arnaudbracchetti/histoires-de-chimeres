import {
  HttpBackend,
  HttpEventType,
  HttpXhrBackend,
  provideHttpClient,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { endpoint } from '@chimeres/contract';
import { injectApiUpload } from './api-upload';

describe('apiUpload()', () => {
  const change = endpoint<string, { scenarioId: string }>('PUT', 'scenarios/:scenarioId/image');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HttpXhrBackend, useExisting: HttpBackend },
      ],
    });
  });

  it('envoie le fichier en multipart, suit la progression, et renvoie la réponse', async () => {
    const apiUpload = TestBed.runInInjectionContext(() => injectApiUpload());
    const http = TestBed.inject(HttpTestingController);
    const progress: number[] = [];
    const file = new File(['abc'], 'image.jpg', { type: 'image/jpeg' });

    const response = apiUpload(change, {
      params: { scenarioId: 'a/b' },
      file,
      field: 'image',
      progress: (fraction) => progress.push(fraction),
    });
    const request = http.expectOne('/api/scenarios/a%2Fb/image');
    request.event({ type: HttpEventType.UploadProgress, loaded: 1, total: 4 });
    request.event({ type: HttpEventType.UploadProgress, loaded: 4, total: 4 });
    request.flush('ok');

    expect(request.request.method).toBe('PUT');
    expect(request.request.reportProgress).toBe(true);
    expect((request.request.body as FormData).get('image')).toBe(file);
    expect(progress).toEqual([0.25, 1]);
    expect(await response).toBe('ok');
  });
});
