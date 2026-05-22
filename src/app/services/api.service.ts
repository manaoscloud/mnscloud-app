import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, map, Observable, startWith } from 'rxjs';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { createInitialFileUploadProgress } from '../shared/upload/file-upload-progress';
import type { FileUploadProgress } from '../shared/upload/file-upload-progress';
import { resolveApiUrl } from '../shared/runtime/app-runtime-config';
export type { FileUploadProgress, FileUploadPhase } from '../shared/upload/file-upload-progress';

@Injectable({ providedIn: 'root' })
export class ApiService {

    private http = inject(HttpClient);
    private auth = inject(AuthService);
    private snack = inject(SnackbarService);

    private normalizeEnvironmentUUID(value: string | null | undefined): string | null {
        const trimmed = value?.trim();
        if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(trimmed)
            ? trimmed
            : null;
    }

    private currentEnvironmentUUID(): string | null {
        const rawStorageEnv =
            typeof localStorage !== 'undefined' ? localStorage.getItem('mc_current_env') : null;
        const envFromStorage =
            typeof localStorage !== 'undefined' ? this.normalizeEnvironmentUUID(rawStorageEnv) : null;
        if (rawStorageEnv && !envFromStorage && typeof localStorage !== 'undefined') {
            localStorage.removeItem('mc_current_env');
        }
        const envFromUser = this.normalizeEnvironmentUUID(this.auth.user()?.EnvironmentUUID);
        return envFromStorage ?? envFromUser;
    }

    private getHeaders(isFormData = false): HttpHeaders {
        const token = this.auth.getToken();
        const environmentUUID = this.currentEnvironmentUUID();

        const headers: Record<string, string> = {
            'Accept': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };

        // 🔹 Environment atual (multi-tenant)
        if (environmentUUID) headers['X-Environment-UUID'] = environmentUUID;

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
        const allowPrefixes = [
            'auth',
            'user',
            'health',
            'openapi.yaml',
            'docs',
            'system',
        ];

        return !allowPrefixes.some((prefix) =>
            normalized === prefix || normalized.startsWith(`${prefix}/`)
        );
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
            this.http.get<T>(this.url(endpoint), { headers: this.getHeaders() }),
        );
    }

    async post<T>(endpoint: string, body: any): Promise<T> {
        this.assertEnvironment(endpoint);
        const isFormData = body instanceof FormData;
        return await firstValueFrom(
            this.http.post<T>(this.url(endpoint), body, { headers: this.getHeaders(isFormData) }),
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
                headers: this.getHeaders(true),
                observe: 'events',
                reportProgress: true,
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
                            currentSpeed === null
                                ? instantSpeed
                                : currentSpeed * 0.7 + instantSpeed * 0.3;

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
            this.http.put<T>(this.url(endpoint), body, { headers: this.getHeaders(isFormData) }),
        );
    }

    async delete<T>(endpoint: string, body?: any): Promise<T> {
        this.assertEnvironment(endpoint);
        return await firstValueFrom(
            this.http.delete<T>(this.url(endpoint), { headers: this.getHeaders(), body }),
        );
    }

    async getMe() {
        return await this.get<any>('user/me');
    }
}
