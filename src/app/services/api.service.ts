import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, map, Observable, startWith } from 'rxjs';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { createInitialFileUploadProgress } from '../shared/upload/file-upload-progress';
import type { FileUploadProgress } from '../shared/upload/file-upload-progress';
import { resolveApiUrl } from '../shared/runtime/app-runtime-config';
import { silentErrorsContext } from '../core/interceptors/silent-errors';
import {
  normalizeEnvironmentUUID,
  readStoredEnvironmentUUID,
} from '../core/environment/environment-context';
export type { FileUploadProgress, FileUploadPhase } from '../shared/upload/file-upload-progress';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(SnackbarService);
  private readonly injector = inject(Injector);

  private registryScope?: Readonly<{ uuid: string; environment: string | null; session: number }>;

  /** Isolated client for one opened Registry workspace, never shared mutable application state. */
  withRegistryWorkspace(uuid: string): ApiService {
    const normalized = normalizeEnvironmentUUID(uuid);
    if (!normalized) throw new Error('Invalid Registry workspace.');
    const client = runInInjectionContext(this.injector, () => new ApiService());
    client.registryScope = {
      uuid: normalized,
      environment: this.currentEnvironmentUUID(),
      session: this.auth.sessionGeneration(),
    };
    return client;
  }

  get registryWorkspaceUUID(): string | null {
    return this.registryScope?.uuid ?? null;
  }

  private commerceScope?: Readonly<{ uuid: string; environment: string | null; session: number }>;

  /** Isolated client for one opened commerce account (Sales catalog, prices, quotations, buyers). */
  withCommerceAccount(uuid: string): ApiService {
    const normalized = normalizeEnvironmentUUID(uuid);
    if (!normalized) throw new Error('Invalid commerce account.');
    const client = runInInjectionContext(this.injector, () => new ApiService());
    client.commerceScope = {
      uuid: normalized,
      environment: this.currentEnvironmentUUID(),
      session: this.auth.sessionGeneration(),
    };
    return client;
  }

  get commerceAccountUUID(): string | null {
    return this.commerceScope?.uuid ?? null;
  }

  /**
   * Sales resources (account administration excluded), their Registry buyers and the shop's Stock,
   * Financial titles/gateways, Fiscal and Accounting. Tenant catalogs stay unscoped.
   */
  static isCommerceAccountEndpoint(endpoint: string): boolean {
    const path = endpoint.replace(/^\//, '');
    return (
      (/^sale\//.test(path) && !/^sale\/accounts([/?]|$)/.test(path)) ||
      /^registry\/customers([/?]|$)/.test(path) ||
      /^(stock|fiscal|accounting)\//.test(path) ||
      /^financial\/(gateway-accounts|payables|payment-charges|receivables|settlements)([/?]|$)/.test(
        path,
      )
    );
  }

  static isRegistryWorkspaceEndpoint(endpoint: string): boolean {
    return /^\/?registry\/(companies|employees|departments|positions|cost-centers)([/?]|$)/.test(
      endpoint,
    );
  }

  private currentEnvironmentUUID(): string | null {
    const envFromStorage = readStoredEnvironmentUUID();
    const envFromUser = normalizeEnvironmentUUID(this.auth.user()?.EnvironmentUUID);
    return envFromStorage ?? envFromUser;
  }

  private getHeaders(endpoint: string, isFormData = false): HttpHeaders {
    const environmentUUID = this.currentEnvironmentUUID();

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.registryScope) {
      if (
        this.registryScope.environment !== environmentUUID ||
        this.registryScope.session !== this.auth.sessionGeneration()
      ) {
        throw new Error('Session changed.');
      }
      if (ApiService.isRegistryWorkspaceEndpoint(endpoint))
        headers['X-Registry-Workspace-UUID'] = this.registryScope.uuid;
    }

    if (this.commerceScope) {
      if (
        this.commerceScope.environment !== environmentUUID ||
        this.commerceScope.session !== this.auth.sessionGeneration()
      ) {
        throw new Error('Session changed.');
      }
      if (ApiService.isCommerceAccountEndpoint(endpoint))
        headers['X-Commerce-Account-UUID'] = this.commerceScope.uuid;
    }

    // 🔹 Environment atual (multi-tenant)
    if (environmentUUID && this.sendsEnvironment(endpoint)) {
      headers['X-Environment-UUID'] = environmentUUID;
    }

    if (!isFormData) headers['Content-Type'] = 'application/json';

    return new HttpHeaders(headers);
  }

  private url(endpoint: string): string {
    return resolveApiUrl(endpoint);
  }

  private requiresEnvironment(endpoint: string): boolean {
    if (!this.auth.isLoggedIn()) return false;

    const normalized = endpoint.replace(/^\//, '');
    if (this.tenantUserEndpoint(endpoint)) return true;
    if (/^user\/operations(?:[/?]|$)/.test(normalized))
      return new URLSearchParams(normalized.split('?')[1] ?? '').get('scope') !== 'platform';
    const allowPrefixes = [
      'auth',
      'user',
      'health',
      'openapi.yaml',
      'docs',
      'system',
      'help/videos',
    ];

    if (this.systemTelemetryContext(endpoint)) return false;
    if (this.environmentOptional(endpoint)) return false;

    return !allowPrefixes.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    );
  }

  private tenantUserEndpoint(endpoint: string): boolean {
    const path = endpoint.replace(/^\//, '').split('?')[0];
    return (
      (/^user\/access\/(members|roles|invites)(?:\/|$)/.test(path) &&
        !/^user\/access\/invites\/(accept|validate)$/.test(path)) ||
      /^user\/access\/(?:[a-f0-9]{32}|[a-f0-9-]{36})$/i.test(path) ||
      (/^user\/permissions(?:\/|$)/.test(path) &&
        !/^user\/permissions\/platform(?:\/|$)/.test(path))
    );
  }

  private sendsEnvironment(endpoint: string): boolean {
    if (this.systemCyberSecurityContext(endpoint) || this.systemTelemetryContext(endpoint))
      return false;
    return (
      endpoint.replace(/^\//, '').split('?')[0] === 'user/me' ||
      this.requiresEnvironment(endpoint) ||
      this.environmentOptional(endpoint)
    );
  }

  private systemTelemetryContext(endpoint: string): boolean {
    if (typeof window === 'undefined') return false;
    const path = endpoint.replace(/^\//, '').split('?')[0];
    const telemetry =
      path === 'monitoring/agents/telemetry-overview' ||
      /^monitoring\/agents\/[^/]+\/resources$/.test(path);
    return telemetry && window.location.pathname.startsWith('/system/monitoring/');
  }

  private environmentOptional(endpoint: string): boolean {
    const normalized = endpoint.replace(/^\//, '');
    return (
      normalized === 'cyber-security' ||
      normalized.startsWith('cyber-security/') ||
      // System hosting writes still need the selected tenant (create host/plan/etc.).
      normalized.startsWith('system/hosting/')
    );
  }

  private systemCyberSecurityContext(endpoint: string): boolean {
    if (!this.environmentOptional(endpoint) || typeof window === 'undefined') return false;
    return window.location.pathname.replace(/\/+$/, '').startsWith('/system/cyber-security');
  }

  private assertEnvironment(endpoint: string) {
    if (!this.requiresEnvironment(endpoint)) return;

    const environmentUUID = this.currentEnvironmentUUID();

    if (!environmentUUID) {
      const message = 'Select an environment before continuing.';
      this.snack.warning(message);
      throw new Error(message);
    }
  }

  /** `silent` is for background reads: failures are thrown without an error toast. */
  async get<T>(endpoint: string, options: { timeout?: number; silent?: boolean } = {}): Promise<T> {
    this.assertEnvironment(endpoint);
    return await firstValueFrom(
      this.http.get<T>(this.url(endpoint), {
        timeout: options.timeout,
        ...(options.silent ? { context: silentErrorsContext() } : {}),
        headers: this.getHeaders(endpoint),
        withCredentials: true,
      }),
    );
  }

  async getBlob(endpoint: string): Promise<Blob> {
    this.assertEnvironment(endpoint);
    return await firstValueFrom(
      this.http.get(this.url(endpoint), {
        headers: this.getHeaders(endpoint),
        responseType: 'blob',
        withCredentials: true,
      }),
    );
  }

  private readonly pendingMutationKeys = new Map<string, string>();

  private async mutation<T>(
    method: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    options?: { idempotencyKey?: string; silent?: boolean },
  ): Promise<T> {
    this.assertEnvironment(endpoint);
    const session = this.auth.sessionGeneration();
    const isFormData = body instanceof FormData;
    const headers = this.getHeaders(endpoint, isFormData);
    // Keep only a digest in memory. A lost response reuses the key for the same intent.
    const serialized = JSON.stringify([
      method,
      endpoint,
      headers.get('X-Environment-UUID'),
      headers.get('X-Registry-Workspace-UUID'),
      headers.get('X-Commerce-Account-UUID'),
      this.auth.user()?.uuid,
      session,
      isFormData ? crypto.randomUUID() : (body ?? null),
    ]);
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))),
    )
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    if (session !== this.auth.sessionGeneration()) throw new Error('Session changed.');
    const key =
      options?.idempotencyKey ?? this.pendingMutationKeys.get(digest) ?? crypto.randomUUID();
    this.pendingMutationKeys.set(digest, key);
    if (this.pendingMutationKeys.size > 100)
      this.pendingMutationKeys.delete(this.pendingMutationKeys.keys().next().value!);
    try {
      const result = await firstValueFrom(
        this.http.request<T>(method, this.url(endpoint), {
          headers: headers.set('Idempotency-Key', key),
          body,
          withCredentials: true,
          ...(options?.silent ? { context: silentErrorsContext() } : {}),
        }),
      );
      this.pendingMutationKeys.delete(digest);
      return result;
    } catch (error) {
      const status = (error as { status?: number })?.status ?? 0;
      if (status >= 400 && status < 500 && ![408, 429].includes(status))
        this.pendingMutationKeys.delete(digest);
      throw error;
    }
  }

  /** `silent`: failures are thrown without an error toast (optional background calls). */
  async post<T>(
    endpoint: string,
    body: any,
    options?: { idempotencyKey?: string; silent?: boolean },
  ): Promise<T> {
    return await this.mutation<T>('POST', endpoint, body, options);
  }

  postFormWithProgress<T>(endpoint: string, body: FormData): Observable<FileUploadProgress<T>> {
    this.assertEnvironment(endpoint);
    const startedAt = performance.now();
    let lastLoaded = 0;
    let lastMeasuredAt = startedAt;
    let currentSpeed: number | null = null;
    let latestLoaded = 0;
    let latestTotal: number | null = null;

    const initial = createInitialFileUploadProgress<T>();

    return this.http
      .post<T>(this.url(endpoint), body, {
        headers: this.getHeaders(endpoint, true),
        observe: 'events',
        reportUploadProgress: true,
        withCredentials: true,
      })
      .pipe(
        map((event): FileUploadProgress<T> => {
          if (event.type === HttpEventType.Sent) return initial;

          if (event.type === HttpEventType.UploadProgress) {
            const now = performance.now();
            const loaded = event.loaded ?? 0;
            const total = event.total ?? null;
            const elapsedSeconds = Math.max((now - lastMeasuredAt) / 1000, 0.001);
            const instantSpeed = Math.max((loaded - lastLoaded) / elapsedSeconds, 0);
            currentSpeed =
              currentSpeed === null ? instantSpeed : currentSpeed * 0.7 + instantSpeed * 0.3;

            lastLoaded = loaded;
            lastMeasuredAt = now;
            latestLoaded = loaded;
            latestTotal = total;

            const percent = total
              ? Math.min(100, Math.max(0, Math.round((loaded / total) * 100)))
              : null;
            const remainingSeconds =
              total && currentSpeed > 0
                ? Math.max(0, Math.ceil((total - loaded) / currentSpeed))
                : null;

            return {
              phase: 'uploading',
              percent,
              loadedBytes: loaded,
              totalBytes: total,
              speedBytesPerSecond: currentSpeed,
              remainingSeconds,
            };
          }

          if (event.type === HttpEventType.ResponseHeader) {
            return {
              phase: 'processing',
              percent: latestTotal ? 100 : null,
              loadedBytes: latestLoaded,
              totalBytes: latestTotal,
              speedBytesPerSecond: currentSpeed,
              remainingSeconds: null,
            };
          }

          if (event.type === HttpEventType.Response) {
            return {
              phase: 'completed',
              percent: 100,
              loadedBytes: latestTotal ?? latestLoaded,
              totalBytes: latestTotal ?? latestLoaded,
              speedBytesPerSecond: currentSpeed,
              remainingSeconds: 0,
              response: event.body as T,
            };
          }

          return {
            phase: 'processing',
            percent: latestTotal ? 100 : null,
            loadedBytes: latestLoaded,
            totalBytes: latestTotal,
            speedBytesPerSecond: currentSpeed,
            remainingSeconds: null,
          };
        }),
        startWith(initial),
      );
  }

  async put<T>(endpoint: string, body: any, options?: { idempotencyKey?: string }): Promise<T> {
    return await this.mutation<T>('PUT', endpoint, body, options);
  }

  async delete<T>(endpoint: string, body?: any, options?: { idempotencyKey?: string }): Promise<T> {
    return await this.mutation<T>('DELETE', endpoint, body, options);
  }

  async getMe() {
    return await this.get<any>('user/me');
  }
}
