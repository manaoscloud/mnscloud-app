import { computed, inject, Injectable } from '@angular/core';
import { APP_BUILD_INFO } from '../app-build-info';
import { AppUpdateService } from './app-update.service';

export type AppRuntimeVersionInfo = {
  product: string;
  version: string;
  channel: string;
  /** Version deployed in this environment (from the App nodes), not the release catalog. */
  latestVersion: string | null;
  latestBuildRef: string | null;
  updateAvailable: boolean;
};

@Injectable({ providedIn: 'root' })
export class RuntimeVersionService {
  private readonly appUpdate = inject(AppUpdateService);

  readonly appVersion = computed<AppRuntimeVersionInfo>(() => {
    const deployed = this.appUpdate.deployed();
    return {
      product: APP_BUILD_INFO.product,
      version: APP_BUILD_INFO.version,
      channel: APP_BUILD_INFO.channel,
      latestVersion: deployed?.version ?? null,
      latestBuildRef: deployed?.buildRef ?? null,
      updateAvailable: this.appUpdate.updateAvailable(),
    };
  });

  async refresh() {
    await this.appUpdate.check(true);
  }

  /** Brings back the update notice after the user postponed it. */
  showUpdateNotice() {
    this.appUpdate.showNotice();
  }
}
