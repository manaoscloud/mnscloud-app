import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiInterceptor } from './api.interceptor';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

describe('apiInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let snack: jasmine.SpyObj<SnackbarService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn', 'expireSession']);
    auth.sessionBootstrapToken = jasmine.createSpy('sessionBootstrapToken').and.returnValue(null);
    snack = jasmine.createSpyObj<SnackbarService>('SnackbarService', ['error']);
    auth.isLoggedIn.and.returnValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: SnackbarService, useValue: snack },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses browser credentials for same-origin API calls without Authorization', async () => {
    const promise = httpClient.get('/api/v1/user/me').toPromise();
    const req = http.expectOne('/api/v1/user/me');

    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();

    req.flush({ status: 'success' });
    await promise;
  });

  it('expires the app session when the API returns 401', async () => {
    const promise = httpClient.get('/api/v1/user/me').toPromise();
    const req = http.expectOne('/api/v1/user/me');
    req.flush({ error: 'Invalid or expired token.' }, { status: 401, statusText: 'Unauthorized' });

    await expectAsync(promise).toBeRejected();
    expect(auth.expireSession).toHaveBeenCalled();
    expect(snack.error).toHaveBeenCalledWith('Your session has expired. Please sign in again.');
  });

  it('adds CSRF header to mutating same-origin requests when the csrf cookie exists', async () => {
    document.cookie = 'mnscloud_csrf=csrf-token; path=/';

    const promise = httpClient.post('/api/v1/settings/themes', {}).toPromise();
    const req = http.expectOne('/api/v1/settings/themes');

    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('X-CSRF-Token')).toBe('csrf-token');

    req.flush({ status: 'success' });
    await promise;
    document.cookie = 'mnscloud_csrf=; path=/; max-age=0';
  });

  it('uses the in-memory bootstrap bearer while the sign-in session is being verified', async () => {
    auth.sessionBootstrapToken.and.returnValue('fresh-jwt');

    const promise = httpClient.get('/api/v1/user/profile').toPromise();
    const req = http.expectOne('/api/v1/user/profile');

    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('Authorization')).toBe('Bearer fresh-jwt');

    req.flush({ status: 'success' });
    await promise;
  });
});
