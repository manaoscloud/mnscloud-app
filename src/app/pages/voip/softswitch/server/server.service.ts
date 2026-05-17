import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipSoftswitchServerItem = {
  VsrUUID: string;
  VsrID: string;
  VsrNodeUUID?: string | null;
  VsrName: string;
  VsrEngine: string;
  VsrHostname?: string | null;
  VsrPublicIP?: string | null;
  VsrPrivateIP?: string | null;
  VsrBaseUrl?: string | null;
  VsrNotes?: string | null;
  VsrStatus: number;
  VsrLastSeenAt?: string | null;
  UserUsrUUID?: string | null;
  VsrDateCreated?: string | null;
  VsrDateUpdated?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchServerService {
  private readonly api = inject(ApiService);

  private basePath(isMaster: boolean) {
    return isMaster ? 'system/voip/softswitch/servers' : 'voip/softswitch/servers';
  }

  list(isMaster = false, params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(isMaster)}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: Partial<VoipSoftswitchServerItem> & { name: string }, isMaster = true) {
    return this.api.post<any>(this.basePath(isMaster), payload);
  }

  update(
    uuid: string,
    payload: Partial<VoipSoftswitchServerItem> & Record<string, unknown>,
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
}
