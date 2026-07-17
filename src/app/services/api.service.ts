import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, map, Observable, startWith } from 'rxjs';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { createInitialFileUploadProgress } from '../shared/upload/file-upload-progress';
import type { FileUploadProgress } from '../shared/upload/file-upload-progress';
import { resolveApiUrl } from '../shared/runtime/app-runtime-config';
import {
  normalizeEnvironmentUUID,
  readStoredEnvironmentUUID,
} from '../core/environment/environment-context';
export type { FileUploadProgress, FileUploadPhase } from '../shared/upload/file-upload-progress';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private snack = inject(SnackbarService);

  private currentEnvironmentUUID(): string | null {
    const envFromStorage = readStoredEnvironmentUUID();
    const envFromUser = normalizeEnvironmentUUID(this.auth.user()?.EnvironmentUUID);
    return envFromStorage ?? envFromUser;
  }

  private getHeaders(endpoint: string, isFormData = false): HttpHeaders {
    const token = this.auth.getToken();
    const environmentUUID = this.currentEnvironmentUUID();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

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
    const token = this.auth.getToken();
    if (!token) return false;

    const normalized = endpoint.replace(/^\//, '');
    const allowPrefixes = ['auth', 'user', 'health', 'openapi.yaml', 'docs', 'system'];

    if (this.environmentOptional(endpoint)) return false;

    return !allowPrefixes.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    );
  }

  private sendsEnvironment(endpoint: string): boolean {
    if (this.systemCyberSecurityContext(endpoint)) return false;
    return this.requiresEnvironment(endpoint) || this.environmentOptional(endpoint);
  }

  private environmentOptional(endpoint: string): boolean {
    const normalized = endpoint.replace(/^\//, '');
    return normalized === 'cyber-security' || normalized.startsWith('cyber-security/');
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

  async get<T>(endpoint: string): Promise<T> {
    this.assertEnvironment(endpoint);
    return await firstValueFrom(
      this.http.get<T>(this.url(endpoint), { headers: this.getHeaders(endpoint) }),
    );
  }

  async getBlob(endpoint: string): Promise<Blob> {
    this.assertEnvironment(endpoint);
    return await firstValueFrom(
      this.http.get(this.url(endpoint), {
        headers: this.getHeaders(endpoint),
        responseType: 'blob',
      }),
    );
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    this.assertEnvironment(endpoint);
    const isFormData = body instanceof FormData;
    return await firstValueFrom(
      this.http.post<T>(this.url(endpoint), body, {
        headers: this.getHeaders(endpoint, isFormData),
      }),
    );
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

  async put<T>(endpoint: string, body: any): Promise<T> {
    this.assertEnvironment(endpoint);
    const isFormData = body instanceof FormData;
    return await firstValueFrom(
      this.http.put<T>(this.url(endpoint), body, {
        headers: this.getHeaders(endpoint, isFormData),
      }),
    );
  }

  async delete<T>(endpoint: string, body?: any): Promise<T> {
    this.assertEnvironment(endpoint);
    return await firstValueFrom(
      this.http.delete<T>(this.url(endpoint), { headers: this.getHeaders(endpoint), body }),
    );
  }

  async getMe() {
    return await this.get<any>('user/me');
  }
}
