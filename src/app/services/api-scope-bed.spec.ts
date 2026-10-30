import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { ENV_STORAGE_KEY } from '../core/environment/environment-context';

export const SCOPE_TEST_TENANT = '11111111-1111-4111-8111-111111111111';

/** ApiService over a spied HttpClient with a controllable session generation (scope specs). */
export function scopedApiTestBed() {
  const state = { generation: 1 };
  localStorage.removeItem(ENV_STORAGE_KEY);
  const http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'request']);
  http.get.and.returnValue(of({}));
  http.request.and.returnValue(of({}));
  const auth = {
    user: () => ({ uuid: 'actor', EnvironmentUUID: SCOPE_TEST_TENANT }),
    isLoggedIn: () => true,
    sessionGeneration: () => state.generation,
  } as unknown as AuthService;
  TestBed.configureTestingModule({
    providers: [
      { provide: HttpClient, useValue: http },
      { provide: AuthService, useValue: auth },
      { provide: SnackbarService, useValue: {} },
    ],
  });
  return { api: TestBed.inject(ApiService), http, state };
}

export function requestHeader(name: string) {
  return (call: jasmine.CallInfo<any>) =>
    (call.args[1] as { headers: HttpHeaders }).headers.get(name);
}
