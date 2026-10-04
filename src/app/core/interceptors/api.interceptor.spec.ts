import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiInterceptor } from './api.interceptor';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ClientDiagnosticsService } from '../../services/client-diagnostics.service';

describe('apiInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let snack: jasmine.SpyObj<SnackbarService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn', 'expireSession']);
    auth.sessionBootstrapToken = jasmine.createSpy('sessionBootstrapToken').and.returnValue(null);
    snack = jasmine.createSpyObj<SnackbarService>('SnackbarService', ['error', 'errorWithAction']);
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

  it('does not toast the runtime install token replacement confirmation', async () => {
    const promise = httpClient
      .post('/api/v1/system/voip/pabx/servers/x/install-command', {})
      .toPromise();
    const req = http.expectOne('/api/v1/system/voip/pabx/servers/x/install-command');
    req.flush(
      { error: 'Confirm', code: 'RUNTIME_TOKEN_REPLACE_CONFIRMATION_REQUIRED', data: {} },
      { status: 409, statusText: 'Conflict' },
    );

    await expectAsync(promise).toBeRejected();
    expect(snack.error).not.toHaveBeenCalled();
  });

  it('still toasts other conflicts', async () => {
    const promise = httpClient.post('/api/v1/example', {}).toPromise();
    const req = http.expectOne('/api/v1/example');
    req.flush({ error: 'Duplicate record.' }, { status: 409, statusText: 'Conflict' });

    await expectAsync(promise).toBeRejected();
    expect(snack.error).toHaveBeenCalled();
  });

  it('records failed calls with their correlation id for problem reports', async () => {
    const promise = httpClient.get('/api/v1/erp/customers?token=abc&page=2').toPromise();
    const req = http.expectOne('/api/v1/erp/customers?token=abc&page=2');
    req.flush(
      { error: 'Invalid filter.' },
      { status: 400, statusText: 'Bad Request', headers: { 'X-Correlation-ID': 'corr-12345678' } },
    );

    await expectAsync(promise).toBeRejected();
    const failure = TestBed.inject(ClientDiagnosticsService).lastFailedRequest();
    expect(failure?.status).toBe(400);
    expect(failure?.requestId).toBe('corr-12345678');
    expect(failure?.url).toBe('/api/v1/erp/customers?token=[redacted]&page=2');
    expect(snack.error).toHaveBeenCalled();
    expect(snack.errorWithAction).not.toHaveBeenCalled();
  });

  it('offers Report problem on server errors', async () => {
    const promise = httpClient.post('/api/v1/example', {}).toPromise();
    const req = http.expectOne('/api/v1/example');
    req.flush({ error: 'Boom.' }, { status: 500, statusText: 'Server Error' });

    await expectAsync(promise).toBeRejected();
    expect(snack.errorWithAction).toHaveBeenCalledWith(
      'Boom.',
      'Report problem',
      jasmine.any(Function),
      8000,
      undefined,
    );
    expect(snack.error).not.toHaveBeenCalled();
  });

  it('does not offer Report problem when sending the report itself fails', async () => {
    const promise = httpClient.post('/api/v1/system/bug-reports', {}).toPromise();
    const req = http.expectOne('/api/v1/system/bug-reports');
    req.flush({ error: 'Boom.' }, { status: 502, statusText: 'Bad Gateway' });

    await expectAsync(promise).toBeRejected();
    expect(snack.errorWithAction).not.toHaveBeenCalled();
    expect(snack.error).toHaveBeenCalled();
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
