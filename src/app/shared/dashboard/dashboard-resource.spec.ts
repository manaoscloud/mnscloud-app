import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';
import { dashboardResource, type DashboardResource } from './dashboard-resource';

describe('dashboardResource', () => {
  const user = signal({ uuid: 'user-a' });
  const tenant = signal({ EnvironmentUUID: 'tenant-a' });
  let resolve: (value: { total: number }) => void;
  let reject: (reason: Error) => void;
  let view: DashboardResource<{ total: number }>;
  async function settle() {
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 0));
    TestBed.tick();
  }
  beforeEach(async () => {
    user.set({ uuid: 'user-a' });
    tenant.set({ EnvironmentUUID: 'tenant-a' });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: TenantService, useValue: { selectedTenant: tenant } },
      ],
    });
    view = TestBed.runInInjectionContext(() =>
      dashboardResource({
        defaultValue: { total: 0 },
        loader: () =>
          new Promise<{ total: number }>((yes, no) => {
            resolve = yes;
            reject = no;
          }),
      }),
    );
    await settle();
  });
  afterEach(() => TestBed.resetTestingModule());
  it('does not identify the initial placeholder as loaded data', async () => {
    expect(view.hasData()).toBeFalse();
    expect(view.updatedAt()).toBeNull();
    reject(new Error('unavailable'));
    await settle();
    expect(view.error()).toBeTruthy();
    expect(view.hasData()).toBeFalse();
    expect(() => view.value()).not.toThrow();
  });
  it('retains a successful snapshot during refresh and on failure, then recovers', async () => {
    resolve({ total: 12 });
    await settle();
    const timestamp = view.updatedAt();
    expect(view.value().total).toBe(12);
    expect(view.hasData()).toBeTrue();
    view.reload();
    await settle();
    expect(view.value().total).toBe(12);
    reject(new Error('offline'));
    await settle();
    expect(view.value().total).toBe(12);
    expect(view.updatedAt()).toBe(timestamp);
    view.reload();
    await settle();
    resolve({ total: 15 });
    await settle();
    expect(view.value().total).toBe(15);
    expect(view.error()).toBeUndefined();
  });
  it('clears retained data immediately when the tenant changes', async () => {
    resolve({ total: 12 });
    await settle();
    tenant.set({ EnvironmentUUID: 'tenant-b' });
    expect(view.hasData()).toBeFalse();
    expect(view.value().total).toBe(0);
    await settle();
    reject(new Error('denied'));
    await settle();
    expect(view.hasData()).toBeFalse();
    expect(view.value().total).toBe(0);
  });
  it('discards an earlier tenant request completing after a new scope starts', async () => {
    const oldResolve = resolve;
    tenant.set({ EnvironmentUUID: 'tenant-b' });
    await settle();
    oldResolve({ total: 999 });
    await settle();
    expect(view.hasData()).toBeFalse();
    resolve({ total: 8 });
    await settle();
    expect(view.value().total).toBe(8);
  });
  it('clears data when the authenticated identity changes', async () => {
    resolve({ total: 12 });
    await settle();
    user.set({ uuid: 'user-b' });
    expect(view.hasData()).toBeFalse();
    expect(view.value().total).toBe(0);
  });
});
