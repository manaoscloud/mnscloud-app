import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../../services/api.service';

export type VoipSoftswitchServerItem = {
  VsrUUID: string;
  VsrID: string;
  VsrNodeUUID?: string | null;
  VsrName: string;
  VsrEngine: string;
  RealtimeMediaServerRmsUUID?: string | null;
  MediaServerName?: string | null;
  RtpengineSocket?: string | null;
  VsrHostname?: string | null;
  VsrPublicIP?: string | null;
  VsrPrivateIP?: string | null;
  VsrBaseUrl?: string | null;
  VsrCodecMode?: string | null;
  VsrAllowedCodecs?: string | null;
  VsrPreferredCodecs?: string | null;
  VsrTranscodeCodecs?: string | null;
  VsrNotes?: string | null;
  VsrStatus: number;
  VsrLastSeenAt?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchServerService {
  private readonly api = inject(ApiService);

  listActive(params: { search?: string; limit?: number; offset?: number } = {}) {
    return this.list(false, { ...params, status: 1 });
  }

  list(
    isMaster: boolean,
    params: { search?: string; status?: number; limit?: number; offset?: number } = {},
  ) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status !== undefined && params.status !== null) {
      query.set('status', String(params.status));
    }
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(isMaster)}${suffix ? `?${suffix}` : ''}`);
  }

  generateInstallCommand(uuid: string) {
    return this.api.post<any>(`system/voip/softswitch/servers/${uuid}/install-command`, {});
  }

  getRuntimeInventory(uuid: string) {
    return this.api.get<any>(`system/voip/softswitch/servers/${uuid}/runtime-inventory`);
  }

  private basePath(isMaster: boolean) {
    return isMaster ? 'system/voip/softswitch/servers' : 'voip/softswitch/servers';
  }
}
