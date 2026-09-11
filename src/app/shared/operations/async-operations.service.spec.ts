import { DestroyRef, provideZonelessChangeDetection, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AsyncOperationsService } from './async-operations.service';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';
import { ApiService } from '../../services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { writeStoredEnvironmentUUID } from '../../core/environment/environment-context';

class Owner extends DestroyRef {
  override destroyed = false;
  callbacks = new Set<() => void>();
  override onDestroy(callback: () => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  close() {
    this.destroyed = true;
    for (const callback of this.callbacks) callback();
  }
}

describe('Queued operations in cookie sessions', () => {
  const operationUUID = '11111111111111111111111111111111';
  let service: AsyncOperationsService;
  let get: jasmine.Spy;
  let generation: ReturnType<typeof signal<number>>;
  let loggedIn: ReturnType<typeof signal<boolean>>;
  let owners: Owner[];
  const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const owner = () => {
    const ref = new Owner();
    owners.push(ref);
    return ref;
  };
  beforeEach(() => {
    jasmine.clock().install();
    localStorage.clear();
    writeStoredEnvironmentUUID('22222222222222222222222222222222');
    owners = [];
    generation = signal(0);
    loggedIn = signal(true);
    get = jasmine.createSpy('get');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: { url: '/hosting/dns/domains' } },
        { provide: AuthService, useValue: { sessionGeneration: generation, isLoggedIn: loggedIn } },
        { provide: TenantService, useValue: { selectedTenant: signal('tenant') } },
        { provide: ApiService, useValue: { get } },
        { provide: SnackbarService, useValue: { info() {}, success() {}, warning() {} } },
      ],
    });
    service = TestBed.inject(AsyncOperationsService);
    TestBed.tick();
  });
  afterEach(() => {
    owners.forEach((ref) => ref.close());
    jasmine.clock().uninstall();
    localStorage.clear();
  });
  it('resumes persisted operations with an HttpOnly session and no legacy token', async () => {
    get.and.resolveTo({ data: { items: [{ operationUUID, state: 'queued' }] } });
    await service.resume(owner());
    expect(get).toHaveBeenCalled();
    expect(service.visible().length).toBe(1);
  });
  it('shares polling while notifying both the status panel and resource page', async () => {
    const panel = owner(),
      page = owner();
    const first = jasmine.createSpy('panel'),
      second = jasmine.createSpy('page');
    service.watch({ operationUUID, state: 'queued' }, panel, first);
    service.watch({ operationUUID, state: 'queued' }, page, second);
    panel.close();
    get.and.resolveTo({ data: { operationUUID, state: 'succeeded' } });
    jasmine.clock().tick(3000);
    await settle();
    expect(get.calls.count()).toBe(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
  it('discards an in-flight response from an expired cookie session', async () => {
    let resolve!: (value: unknown) => void;
    get.and.returnValue(new Promise((done) => (resolve = done)));
    const callback = jasmine.createSpy('settled');
    service.watch({ operationUUID, state: 'queued' }, owner(), callback);
    jasmine.clock().tick(3000);
    generation.update((value) => value + 1);
    loggedIn.set(false);
    TestBed.tick();
    resolve({ data: { operationUUID, state: 'succeeded' } });
    await settle();
    expect(service.visible()).toEqual([]);
    expect(callback).not.toHaveBeenCalled();
  });
  it('settles a replayed terminal receipt without submitting or polling again', () => {
    const callback = jasmine.createSpy('settled');
    service.watch({ operationUUID, state: 'succeeded' }, owner(), callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });
});
