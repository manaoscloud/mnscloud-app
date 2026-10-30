import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { ENV_STORAGE_KEY } from '../core/environment/environment-context';

describe('Commerce account API client', () => {
  const tenant = '11111111-1111-4111-8111-111111111111';
  const shopA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const shopB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let generation: number;
  let http: jasmine.SpyObj<HttpClient>;
  let api: ApiService;
  beforeEach(() => {
    localStorage.removeItem(ENV_STORAGE_KEY);
    generation = 1;
    http = jasmine.createSpyObj('HttpClient', ['get', 'request']);
    http.get.and.returnValue(of({}));
    http.request.and.returnValue(of({}));
    const auth = {
      user: () => ({ uuid: 'actor', EnvironmentUUID: tenant }),
      isLoggedIn: () => true,
      sessionGeneration: () => generation,
    } as unknown as AuthService;
    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: http },
        { provide: AuthService, useValue: auth },
        { provide: SnackbarService, useValue: {} },
      ],
    });
    api = TestBed.inject(ApiService);
  });
  afterEach(() => localStorage.removeItem(ENV_STORAGE_KEY));
  const header = (call: jasmine.CallInfo<any>) =>
    (call.args[1] as { headers: HttpHeaders }).headers.get('X-Commerce-Account-UUID');
  it('scopes Sales resources and buyers only, keeping simultaneous accounts apart', async () => {
    const a = api.withCommerceAccount(shopA);
    const b = api.withCommerceAccount(shopB);
    await Promise.all([
      a.get('sale/products'),
      b.get('sale/products'),
      api.get('sale/products'),
      a.get('registry/customers?status=1'),
      a.get('sale/accounts'),
      a.get('pos/terminals'),
      a.get('stock/movements'),
      a.get('registry/companies'),
    ]);
    expect(http.get.calls.all().map(header)).toEqual([shopA, shopB, null, shopA, null, null, null, null]);
    await a.get('sale/quotations/q/items');
    expect(header(http.get.calls.mostRecent())).toBe(shopA);
  });
  it('rejects stale dialogs after tenant or session changes without issuing HTTP', async () => {
    const scoped = api.withCommerceAccount(shopA);
    localStorage.setItem(ENV_STORAGE_KEY, shopB);
    await expectAsync(scoped.get('sale/products')).toBeRejectedWithError('Session changed.');
    localStorage.removeItem(ENV_STORAGE_KEY);
    generation++;
    await expectAsync(scoped.get('sale/products')).toBeRejectedWithError('Session changed.');
    expect(http.get).not.toHaveBeenCalled();
  });
  it('rejects malformed explicit selection rather than using the internal account', () => {
    expect(() => api.withCommerceAccount('invalid')).toThrowError('Invalid commerce account.');
  });
});
