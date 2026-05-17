import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipSoftswitchProviderItem = {
  VspUUID: string;
  VspID: string;
  VspName: string;
  VspEngine: string;
  VspConfig?: unknown;
  VspStatus: number;
  UserUsrUUID?: string | null;
  VspDateCreated?: string | null;
  VspDateUpdated?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchProviderService {
  private readonly api = inject(ApiService);

  private basePath(isMaster: boolean) {
    return isMaster ? 'system/voip/softswitch/providers' : 'voip/softswitch/providers';
  }

  list(isMaster = false, params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(isMaster)}${suffix ? `?${suffix}` : ''}`);
  }

  create(
    payload: {
      name: string;
      engine: string;
      config?: Record<string, unknown> | null;
      credentials?: Record<string, unknown> | null;
      status?: number;
    },
    isMaster = false,
  ) {
    return this.api.post<any>(this.basePath(isMaster), payload);
  }

  update(
    uuid: string,
    payload: {
      name?: string;
      engine?: string;
      config?: Record<string, unknown> | null;
      credentials?: Record<string, unknown> | null;
      status?: number;
    },
    isMaster = false,
  ) {
    return this.api.put<any>(`${this.basePath(isMaster)}/${uuid}`, payload);
  }

  remove(uuid: string, isMaster = false) {
    return this.api.delete<any>(`${this.basePath(isMaster)}/${uuid}`);
  }

  removeMany(ids: string[], isMaster = false) {
    return this.api.delete<any>(`${this.basePath(isMaster)}/bulk`, { ids });
  }
}
