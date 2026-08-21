import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../../services/api.service';

export type VoipSbcServerItem = {
  VbsUUID: string;
  VbsID: string;
  VbsNodeUUID?: string | null;
  VbsName: string;
  VbsEngine: string;
  RealtimeMediaServerRmsUUID?: string | null;
  MediaServerName?: string | null;
  RtpengineSocket?: string | null;
  VbsHostname?: string | null;
  VbsPublicIP?: string | null;
  VbsPrivateIP?: string | null;
  VbsAdvertisedIP?: string | null;
  VbsAdvertisedIPSource?: string | null;
  VbsBaseUrl?: string | null;
  VbsCodecMode?: string | null;
  VbsAllowedCodecs?: string | null;
  VbsPreferredCodecs?: string | null;
  VbsTranscodeCodecs?: string | null;
  VbsNotes?: string | null;
  VbsStatus: number;
  VbsLastSeenAt?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipSbcServerService {
  private readonly api = inject(ApiService);

  generateInstallCommand(uuid: string) {
    return this.api.post<any>(`system/voip/sbc/servers/${uuid}/install-command`, {});
  }
}
