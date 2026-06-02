import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_BUILD_INFO } from '../app-build-info';

type RuntimeReleaseInfo = {
  product?: string | null;
  version?: string | null;
  buildRef?: string | null;
  ref?: string | null;
  releasedAt?: string | null;
};

type GitHubReleaseResponse = {
  tag_name?: string | null;
  published_at?: string | null;
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
      const release = await firstValueFrom(
        this.http.get<GitHubReleaseResponse>(
          'https://api.github.com/repos/manaoscloud/mnscloud-app/releases/latest',
        ),
      );
      const version = release.tag_name?.trim().replace(/^v/i, '') || null;
      this.latestAppRelease.set(
        version
          ? {
              product: 'mnscloud-app',
              version,
              ref: release.tag_name?.trim() || `v${version}`,
              buildRef: null,
              releasedAt: release.published_at ?? null,
            }
          : null,
      );
    } catch {
      this.latestAppRelease.set(null);
    }
  }
}
