import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { RouteScopeService } from '../core/scope/route-scope';

describe('ApiService auth and tenant context', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let generation: number;

  beforeEach(() => {
    generation = 0;
    localStorage.clear();
    sessionStorage.clear();
    (window as any).MNSCLOUD_APP_CONFIG = { apiBaseUrl: 'https://api.example.com/api/v1' };

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
    const req = http.expectOne('https://api.example.com/api/v1/hosting/dns/domains');

    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.headers.get('X-Environment-UUID')).toBe(
      '11111111-1111-1111-1111-111111111111',
    );

    req.flush({ status: 'success', data: [] });
    await promise;
  });

  it('uses the selected tenant for membership, profiles and effective permissions after switching', async () => {
    localStorage.setItem('mc_current_env', '22222222-2222-2222-2222-222222222222');
    for (const endpoint of [
      'user/me',
      'user/access/members',
      'user/access/invites',
      'user/access/roles?limit=500',
      'user/permissions/roles',
    ]) {
      const pending = api.get(endpoint);
      const req = http.expectOne('https://api.example.com/api/v1/' + endpoint);
      expect(req.request.headers.get('X-Environment-UUID')).toBe(
        '22222222-2222-2222-2222-222222222222',
      );
      req.flush({ data: { items: [] } });
      await pending;
    }
  });

  it('does not attach tenant context to platform permission administration', async () => {
    const pending = api.get('user/permissions/platform/roles');
    const req = http.expectOne('https://api.example.com/api/v1/user/permissions/platform/roles');
    expect(req.request.headers.has('X-Environment-UUID')).toBeFalse();
    req.flush({ data: { items: [] } });
    await pending;
  });

  it('never attaches the selected tenant on /system routes, whatever the endpoint', async () => {
    const scope = TestBed.inject(RouteScopeService);
    spyOn(scope, 'isSystemTree').and.returnValue(true);
    for (const endpoint of [
      'monitoring/agents/telemetry-overview?limit=12',
      'system/hosting/vps/instances',
      'cyber-security/lists',
    ]) {
      const promise = api.get(endpoint);
      const req = http.expectOne(`https://api.example.com/api/v1/${endpoint}`);
      expect(req.request.headers.has('X-Environment-UUID')).toBeFalse();
      req.flush({ status: 'success', data: { items: [] } });
      await promise;
    }
  });

  it('always attaches the selected tenant on tenant routes, platform endpoints included', async () => {
    localStorage.setItem('mc_current_env', '22222222-2222-2222-2222-222222222222');
    for (const endpoint of [
      'system/voip/did/numbers',
      'cyber-security/lists',
      'monitoring/agents',
    ]) {
      const promise = api.get(endpoint);
      const req = http.expectOne(`https://api.example.com/api/v1/${endpoint}`);
      expect(req.request.headers.get('X-Environment-UUID')).toBe(
        '22222222-2222-2222-2222-222222222222',
      );
      req.flush({ status: 'success', data: { items: [] } });
      await promise;
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
