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

  beforeEach(() => {
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
});
