import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { ENV_STORAGE_KEY } from '../core/environment/environment-context';

describe('HR account API client', () => {
  const tenant = '11111111-1111-4111-8111-111111111111';
  const accountA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const accountB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const workspace = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
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
  const header = (name: string) => (call: jasmine.CallInfo<any>) =>
    (call.args[1] as { headers: HttpHeaders }).headers.get(name);
  it('sends the HR account only on HR resource routes of its own client', async () => {
    const a = api.withHrAccount(accountA);
    const b = api.withHrAccount(accountB, workspace);
    await Promise.all([
      a.get('hr/time-clock-accounts'),
      b.get('hr/employees?limit=50'),
      api.get('hr/time-clock-accounts'),
      a.get('hr/accounts'),
      b.get('registry/employees'),
      a.get('registry/employees'),
    ]);
    const calls = http.get.calls.all();
    expect(calls.map(header('X-Hr-Account-UUID'))).toEqual([
      accountA,
      accountB,
      null,
      null,
      null,
      null,
    ]);
    expect(calls.map(header('X-Registry-Workspace-UUID'))).toEqual([
      null,
      null,
      null,
      null,
      workspace,
      null,
    ]);
  });
  it('rejects stale HR clients after tenant or session changes without issuing HTTP', async () => {
    const scoped = api.withHrAccount(accountA);
    generation++;
    await expectAsync(scoped.get('hr/holidays')).toBeRejectedWithError('Session changed.');
    expect(http.get).not.toHaveBeenCalled();
  });
  it('rejects malformed HR account selection rather than using the internal account', () => {
    expect(() => api.withHrAccount('invalid')).toThrowError('Invalid HR account.');
  });
});
