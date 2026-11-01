import type { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { ENV_STORAGE_KEY } from '../core/environment/environment-context';
import { requestHeader, scopedApiTestBed } from './api-scope-bed.spec';

describe('Commerce account API client', () => {
  const shopA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const shopB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const header = requestHeader('X-Commerce-Account-UUID');
  let bed: { api: ApiService; http: jasmine.SpyObj<HttpClient>; state: { generation: number } };
  beforeEach(() => (bed = scopedApiTestBed()));
  afterEach(() => localStorage.removeItem(ENV_STORAGE_KEY));
  it('scopes Sales resources and buyers only, keeping simultaneous accounts apart', async () => {
    const a = bed.api.withCommerceAccount(shopA);
    const b = bed.api.withCommerceAccount(shopB);
    await Promise.all(
      [
        'sale/products',
        'registry/customers?status=1',
        'sale/accounts',
        'pos/terminals',
        'stock/movements',
        'financial/receivables',
        'financial/payment-methods',
        'fiscal/documents',
      ].map((e) => a.get(e)),
    );
    await b.get('sale/products');
    await bed.api.get('sale/products');
    expect(bed.http.get.calls.all().map(header)).toEqual([
      shopA,
      shopA,
      null,
      null,
      shopA,
      shopA,
      null,
      shopA,
      shopB,
      null,
    ]);
  });
  it('refuses stale dialogs after a tenant or session change', async () => {
    const scoped = bed.api.withCommerceAccount(shopA);
    bed.state.generation++;
    await expectAsync(scoped.get('sale/products')).toBeRejectedWithError('Session changed.');
    expect(bed.http.get).not.toHaveBeenCalled();
    expect(() => bed.api.withCommerceAccount('invalid')).toThrowError('Invalid commerce account.');
  });
});
