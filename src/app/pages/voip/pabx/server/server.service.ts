import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipPabxServerItem = {
  VpsUUID: string;
  VpsID: string;
  VpsNodeUUID?: string | null;
  VpsName: string;
  VpsEngine: string;
  VpsHostname?: string | null;
  VpsPublicIPv4?: string | null;
  VpsPublicIPv6?: string | null;
  VpsPrivateIPv4?: string | null;
  VpsPrivateIPv6?: string | null;
  VpsAdvertisedIP?: string | null;
  VpsAdvertisedIPSource?: string | null;
  VpsBaseUrl?: string | null;
  VpsControlHost?: string | null;
  VpsControlPort?: number | null;
  VpsControlUsername?: string | null;
  VpsControlAllowedIps?: string | null;
  VpsRemoteCommandExecutor?: 'agent' | 'esl_ami' | string | null;
  VpsControlSecretSet?: number | boolean | null;
  VpsNotes?: string | null;
  VpsStatus: number;
  VpsLastSeenAt?: string | null;
  UserUsrUUID?: string | null;
  VpsDateCreated?: string | null;
  VpsDateUpdated?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxServerService {
  private readonly api = inject(ApiService);

  private basePath(isMaster: boolean) {
    return isMaster ? 'system/voip/pabx/servers' : 'voip/pabx/servers';
  }

  list(
    isMaster = false,
    params: { search?: string; status?: number; limit?: number; offset?: number } = {},
  ) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status !== undefined && params.status !== null) query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(isMaster)}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: Partial<VoipPabxServerItem> & { name: string }, isMaster = true) {
    return this.api.post<any>(this.basePath(isMaster), payload);
  }

  update(
    uuid: string,
    payload: Partial<VoipPabxServerItem> & Record<string, unknown>,
    isMaster = true,
  ) {
    return this.api.put<any>(`${this.basePath(isMaster)}/${uuid}`, payload);
  }

  remove(uuid: string, isMaster = true) {
    return this.api.delete<any>(`${this.basePath(isMaster)}/${uuid}`);
  }

  removeMany(ids: string[], isMaster = true) {
    return this.api.delete<any>(`${this.basePath(isMaster)}/bulk`, { ids });
  }

  validateControl(uuid: string, isMaster = true) {
    return this.api.post<any>(`${this.basePath(isMaster)}/${uuid}/validate-control`, {});
  }

  generateInstallCommand(uuid: string, isMaster = true) {
    return this.api.post<any>(`${this.basePath(isMaster)}/${uuid}/install-command`, {});
  }
}
