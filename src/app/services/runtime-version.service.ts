import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_BUILD_INFO } from '../app-build-info';
import { resolveApiUrl } from '../shared/runtime/app-runtime-config';

type RuntimeReleaseInfo = {
  product?: string | null;
  version?: string | null;
  buildRef?: string | null;
  ref?: string | null;
  releasedAt?: string | null;
};

type RuntimeReleaseApiResponse = {
  status?: string;
  data?: RuntimeReleaseInfo | null;
};

export type AppRuntimeVersionInfo = {
  product: string;
  version: string;
  channel: string;
  latestVersion: string | null;
  latestBuildRef: string | null;
  updateAvailable: boolean;
};

@Injectable({ providedIn: 'root' })
export class RuntimeVersionService {
  private readonly http = inject(HttpClient);
  private readonly latestAppRelease = signal<RuntimeReleaseInfo | null>(null);

  readonly appVersion = computed<AppRuntimeVersionInfo>(() => {
    const latest = this.latestAppRelease();
    const latestVersion = latest?.version?.trim() || null;
    return {
      product: APP_BUILD_INFO.product,
      version: APP_BUILD_INFO.version,
      channel: APP_BUILD_INFO.channel,
      latestVersion,
      latestBuildRef: latest?.buildRef?.trim() || null,
      updateAvailable: Boolean(latestVersion && latestVersion !== APP_BUILD_INFO.version),
    };
  });

  async refresh() {
    try {
      const response = await firstValueFrom(
        this.http.get<RuntimeReleaseApiResponse>(
          resolveApiUrl('runtime/releases/latest?product=mnscloud-app'),
        ),
      );
      const release = response.data ?? null;
      const version = release?.version?.trim() || null;
      this.latestAppRelease.set(version ? release : null);
    } catch {
      this.latestAppRelease.set(null);
    }
  }
}
