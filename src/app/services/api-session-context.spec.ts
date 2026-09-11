import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';

describe('ApiService auth and tenant context', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let generation: number;

  beforeEach(() => {
    generation = 0;
    localStorage.clear();
    sessionStorage.clear();
    (window as any).MNSCLOUD_APP_CONFIG = { apiBaseUrl: 'https://dev.publichost.cloud/api/v1' };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService,
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => true,
            sessionGeneration: () => generation,
            user: () => ({ EnvironmentUUID: '11111111-1111-1111-1111-111111111111' }),
          },
        },
        { provide: SnackbarService, useValue: { warning: jasmine.createSpy('warning') } },
      ],
    });

    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
    delete (window as any).MNSCLOUD_APP_CONFIG;
  });

  it('sends credentials and tenant context without an Authorization header', async () => {
    const promise = api.get('hosting/dns/domains');
    const req = http.expectOne('https://dev.publichost.cloud/api/v1/hosting/dns/domains');

    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.get('X-Environment-UUID')).toBe(
      '11111111-1111-1111-1111-111111111111',
    );

    req.flush({ status: 'success', data: [] });
    await promise;
  });

  it('does not attach a selected tenant to the master telemetry overview', async () => {
    const previous = window.location.pathname;
    history.replaceState(null, '', '/system/monitoring/overview');
    try {
      const promise = api.get('monitoring/agents/telemetry-overview?limit=12');
      const req = http.expectOne(
        'https://dev.publichost.cloud/api/v1/monitoring/agents/telemetry-overview?limit=12',
      );
      expect(req.request.headers.has('X-Environment-UUID')).toBeFalse();
      req.flush({ status: 'success', data: { items: [], total: 0, limit: 12, offset: 0 } });
      await promise;
    } finally {
      history.replaceState(null, '', previous);
    }
  });

  it('fails closed when a tenant-scoped route has no selected environment', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService,
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => true, user: () => ({ EnvironmentUUID: null }) },
        },
        { provide: SnackbarService, useValue: { warning: jasmine.createSpy('warning') } },
      ],
    });
    const isolatedApi = TestBed.inject(ApiService);

    await expectAsync(isolatedApi.get('hosting/dns/domains')).toBeRejectedWithError(
      'Select an environment before continuing.',
    );
  });
  it('reuses uncertain requests within one session and separates later logins', async () => {
    const endpoint = 'hosting/dns/domains';
    const pendingRequest = async () => {
      for (let i = 0; i < 100; i++) {
        const found = http.match((request) => request.url.endsWith(endpoint));
        if (found.length) return found[0];
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new Error('Expected HTTP mutation');
    };
    const first = api.post(endpoint, { name: 'example.invalid' }).catch((error) => error);
    const request1 = await pendingRequest();
    const key = request1.request.headers.get('Idempotency-Key');
    request1.flush({}, { status: 503, statusText: 'Unavailable' });
    await first;
    const retry = api.post(endpoint, { name: 'example.invalid' }).catch((error) => error);
    const request2 = await pendingRequest();
    expect(request2.request.headers.get('Idempotency-Key')).toBe(key);
    expect(request2.request.withCredentials).toBeTrue();
    request2.flush({}, { status: 503, statusText: 'Unavailable' });
    await retry;
    generation++;
    const later = api.post(endpoint, { name: 'example.invalid' });
    const request3 = await pendingRequest();
    expect(request3.request.headers.get('Idempotency-Key')).not.toBe(key);
    request3.flush({ status: 'success' });
    await later;
  });
});
