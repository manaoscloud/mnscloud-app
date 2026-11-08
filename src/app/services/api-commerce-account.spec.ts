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
        'pos/auth/signin',
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
      shopA,
      null,
      shopA,
      shopA,
      null,
      shopA,
      shopB,
      null,
    ]);
  });
  it('opens the POS in the account and scopes the shop companies to its workspace', async () => {
    const workspace = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const scoped = bed.api.withCommerceAccount(shopA, workspace);
    await scoped.post('pos/auth/handoffs', { terminalUUID: null });
    await scoped.get('registry/companies');
    const registry = requestHeader('X-Registry-Workspace-UUID');
    const posted = bed.http.request.calls
      .all()
      .map((call) =>
        (call.args[2] as { headers: { get(n: string): string | null } }).headers.get(
          'X-Commerce-Account-UUID',
        ),
      );
    expect(posted).toEqual([shopA]);
    expect(bed.http.get.calls.all().map(registry)).toEqual([workspace]);
    expect(bed.http.get.calls.all().map(header)).toEqual([null]);
  });
  it('refuses stale dialogs after a tenant or session change', async () => {
    const scoped = bed.api.withCommerceAccount(shopA);
    bed.state.generation++;
    await expectAsync(scoped.get('sale/products')).toBeRejectedWithError('Session changed.');
    expect(bed.http.get).not.toHaveBeenCalled();
    expect(() => bed.api.withCommerceAccount('invalid')).toThrowError('Invalid commerce account.');
  });
});
