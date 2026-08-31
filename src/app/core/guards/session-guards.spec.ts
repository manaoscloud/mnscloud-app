import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { environmentGuard } from './environment.guard';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

describe('session guards', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('allows authenticated routes based on cookie-backed UI state', () => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: { isLoggedIn: () => true } },
        { provide: Router, useValue: router },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('recovers tenant context from user access on refresh', async () => {
    const router = jasmine.createSpyObj<Router>('Router', ['parseUrl']);
    const authUser = signal({
      uuid: 'user-1',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      EnvironmentUUID: null,
    });
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['updateUser'], {
      user: authUser.asReadonly(),
    });
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.withArgs('user/access').and.resolveTo({
      data: {
        access: [
          {
            EnvironmentUUID: '22222222-2222-2222-2222-222222222222',
            IsDefault: 1,
            Status: 'Active',
          },
        ],
      },
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      environmentGuard({} as any, {} as any),
    );

    expect(result).toBeTrue();
    expect(localStorage.getItem('mc_current_env')).toBe('22222222-2222-2222-2222-222222222222');
    expect(auth.updateUser).toHaveBeenCalledWith({
      EnvironmentUUID: '22222222-2222-2222-2222-222222222222',
    });
  });
});
