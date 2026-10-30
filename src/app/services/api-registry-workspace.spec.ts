import type { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { ENV_STORAGE_KEY } from '../core/environment/environment-context';
import { requestHeader, scopedApiTestBed } from './api-scope-bed.spec';

describe('Registry workspace API client', () => {
  const workspaceA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const workspaceB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let generation = { generation: 1 };
  let http: jasmine.SpyObj<HttpClient>;
  let api: ApiService;
  beforeEach(() => {
    const bed = scopedApiTestBed();
    ({ api, http } = bed);
    generation = bed.state;
  });
  afterEach(() => localStorage.removeItem(ENV_STORAGE_KEY));
  const header = requestHeader('X-Registry-Workspace-UUID');
  it('keeps simultaneous client scopes separate and excludes legacy module requests', async () => {
    const a = api.withRegistryWorkspace(workspaceA);
    const b = api.withRegistryWorkspace(workspaceB);
    await Promise.all([
      a.get('registry/employees'),
      b.get('registry/employees'),
      api.get('registry/employees'),
      a.get('hr/punches'),
      a.get('registry/customers'),
    ]);
    expect(http.get.calls.all().map(header)).toEqual([workspaceA, workspaceB, null, null, null]);
    await a.get('registry/companies/company/documents/doc/versions/version/content');
    expect(header(http.get.calls.mostRecent())).toBe(workspaceA);
  });
  it('rejects stale dialogs after tenant or session changes without issuing HTTP', async () => {
    const scoped = api.withRegistryWorkspace(workspaceA);
    localStorage.setItem(ENV_STORAGE_KEY, workspaceB);
    await expectAsync(scoped.get('registry/employees')).toBeRejectedWithError('Session changed.');
    localStorage.removeItem(ENV_STORAGE_KEY);
    generation.generation++;
    await expectAsync(scoped.get('registry/employees')).toBeRejectedWithError('Session changed.');
    expect(http.get).not.toHaveBeenCalled();
  });
  it('rejects malformed explicit selection rather than using internal records', () => {
    expect(() => api.withRegistryWorkspace('invalid')).toThrowError('Invalid Registry workspace.');
  });
});
