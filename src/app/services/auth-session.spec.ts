import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

describe('AuthService cookie session state', () => {
  let service: AuthService;
  let api: jasmine.SpyObj<ApiService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/dashboard' });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthService,
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps login refresh state without persisting JWT in web storage', async () => {
    api.get.withArgs('user/profile').and.resolveTo({
      data: {
        UserUUID: 'user-1',
        Email: 'user@example.com',
        FirstName: 'Ada',
        LastName: 'Lovelace',
      },
    });
    api.get.withArgs('user/me').and.resolveTo({
      data: {
        EnvironmentUUID: '11111111-1111-1111-1111-111111111111',
        permissions: ['platform.master.access'],
      },
    });

    const ok = await service.login(
      {
        uuid: 'user-1',
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        EnvironmentUUID: '11111111-1111-1111-1111-111111111111',
        permissions: ['platform.master.access'],
      },
      api,
      true,
      'transient-jwt',
    );

    expect(ok).toBeTrue();
    expect(service.isLoggedIn()).toBeTrue();
    expect(localStorage.getItem('mnscloud_auth')).toBe('true');
    expect(localStorage.getItem('mnscloud_jwt')).toBeNull();
    expect(sessionStorage.getItem('mnscloud_jwt')).toBeNull();
    expect(service.user()?.permissions).toContain('platform.master.access');
    expect(service.sessionBootstrapToken()).toBeNull();
  });

  it('clears auth UI state and tenant context on logout', () => {
    localStorage.setItem('mnscloud_auth', 'true');
    localStorage.setItem('mnscloud_user', JSON.stringify({ uuid: 'u', email: 'e' }));
    localStorage.setItem('mnscloud_jwt', 'legacy-token');
    localStorage.setItem('mc_current_env', '11111111-1111-1111-1111-111111111111');

    service.logout();

    expect(service.isLoggedIn()).toBeFalse();
    expect(localStorage.getItem('mnscloud_auth')).toBeNull();
    expect(localStorage.getItem('mnscloud_user')).toBeNull();
    expect(localStorage.getItem('mnscloud_jwt')).toBeNull();
    expect(localStorage.getItem('mc_current_env')).toBeNull();
  });

  it('can defer profile loading during signin bootstrap without persisting JWT', async () => {
    const ok = await service.login(
      {
        uuid: 'user-1',
        email: 'user@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        EnvironmentUUID: '11111111-1111-1111-1111-111111111111',
        permissions: ['platform.master.access'],
      },
      api,
      true,
      'transient-jwt',
      { deferProfileLoad: true },
    );

    expect(ok).toBeTrue();
    expect(api.get).not.toHaveBeenCalled();
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.user()?.email).toBe('user@example.com');
    expect(localStorage.getItem('mnscloud_jwt')).toBeNull();
    expect(sessionStorage.getItem('mnscloud_jwt')).toBeNull();
    expect(service.sessionBootstrapToken()).toBeNull();
  });
});
