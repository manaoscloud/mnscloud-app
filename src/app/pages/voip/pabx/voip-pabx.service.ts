import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type VoipPabxAccount = {
  VpaUUID: string;
  VpaID: string;
  VpaName: string;
  VoipPabxServerVpsUUID?: string | null;
  VoipDomainVdmUUID?: string | null;
  CustomerCusUUID?: string | null;
  VoipPabxDialPlanVdpUUID?: string | null;
  VoipBlacklistVbkUUID?: string | null;
  VpaRecordingStorageMode: 'default' | 'filesystem' | 'storage';
  HostingStorageAccountHsaUUID?: string | null;
  VpaMediaStorageMode?: 'default' | 'filesystem' | 'storage';
  MediaHostingStorageAccountHsaUUID?: string | null;
  VpaMediaDeliveryMode?: 'default' | 'online' | 'offline';
  VpaTimezone?: string | null;
  VpaEffectiveTimezone?: string | null;
  VpaTimezoneSource?: string | null;
  RecordingStorageAccountName?: string | null;
  RecordingStorageProviderName?: string | null;
  RecordingStorageProvider?: string | null;
  RecordingStorageEffectivePath?: string | null;
  RecordingStoragePublicUrl?: string | null;
  VpaDefaultAudioCodecs?: string | null;
  VpaDefaultVideoCodecs?: string | null;
  ServerName?: string | null;
  ServerEngine?: string | null;
  ServerHostname?: string | null;
  ServerPublicIP?: string | null;
  ServerPrivateIP?: string | null;
  ServerStatus?: number | null;
  DomainName?: string | null;
  DomainStatus?: number | null;
  CustomerName?: string | null;
  DialPlanName?: string | null;
  BlacklistName?: string | null;
  VpaIsActive: number;
  VpaIsDefault: number;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxService {
  private readonly api = inject(ApiService);

  private readonly basePath = 'voip/pabx/accounts';

  list(params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: {
    name: string;
    serverUUID?: string;
    domainUUID?: string;
    customerUUID?: string;
    dialPlanUUID?: string;
    blacklistUUID?: string;
    recordingStorageMode?: 'default' | 'filesystem' | 'storage';
    storageAccountUUID?: string;
    mediaStorageMode?: 'default' | 'filesystem' | 'storage';
    mediaStorageAccountUUID?: string;
    mediaDeliveryMode?: 'default' | 'online' | 'offline';
    timezone?: string;
    defaultAudioCodecs?: string;
    defaultVideoCodecs?: string;
    isActive?: boolean;
    isDefault?: boolean;
  }) {
    return this.api.post<any>(this.basePath, payload);
  }

  update(
    uuid: string,
    payload: {
      name?: string;
      serverUUID?: string;
      domainUUID?: string;
      customerUUID?: string;
      dialPlanUUID?: string;
      blacklistUUID?: string;
      recordingStorageMode?: 'default' | 'filesystem' | 'storage';
      storageAccountUUID?: string;
      mediaStorageMode?: 'default' | 'filesystem' | 'storage';
      mediaStorageAccountUUID?: string;
      mediaDeliveryMode?: 'default' | 'online' | 'offline';
      timezone?: string;
      defaultAudioCodecs?: string;
      defaultVideoCodecs?: string;
      isActive?: boolean;
      isDefault?: boolean;
    },
  ) {
    return this.api.put<any>(`${this.basePath}/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`${this.basePath}/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>(`${this.basePath}/bulk`, { ids });
  }

  resolveDefault() {
    return this.api.get<any>(`${this.basePath}/default`);
  }
}
