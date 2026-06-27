import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type VoipSoftswitchAccount = {
  VssUUID: string;
  VssID: string;
  VssName: string;
  VoipSoftswitchProviderVspUUID: string;
  VoipSoftswitchServerVsrUUID?: string | null;
  VoipDomainVdmUUID?: string | null;
  CustomerCusUUID?: string | null;
  VssConfig?: unknown;
  VssIsActive: number;
  VssIsDefault: number;
  ProviderName?: string | null;
  ProviderEngine?: string | null;
  ServerName?: string | null;
  ServerHostname?: string | null;
  DomainName?: string | null;
  CustomerName?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchAccountService {
  private readonly api = inject(ApiService);

  private basePath(isMaster: boolean) {
    return isMaster ? 'system/voip/softswitch/accounts' : 'voip/softswitch/accounts';
  }

  list(
    isMaster = false,
    params: { search?: string; status?: number; limit?: number; offset?: number } = {},
  ) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status !== undefined && params.status !== null)
      query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(isMaster)}${suffix ? `?${suffix}` : ''}`);
  }

  create(
    payload: {
      name: string;
      providerUUID: string;
      serverUUID: string;
      domainUUID: string;
      customerUUID: string;
      config?: Record<string, unknown> | null;
      credentials?: Record<string, unknown> | null;
      isActive?: boolean;
      isDefault?: boolean;
    },
    isMaster = false,
  ) {
    return this.api.post<any>(this.basePath(isMaster), payload);
  }

  update(
    uuid: string,
    payload: {
      name?: string;
      providerUUID?: string;
      serverUUID?: string | null;
      domainUUID?: string | null;
      customerUUID?: string | null;
      config?: Record<string, unknown> | null;
      credentials?: Record<string, unknown> | null;
      isActive?: boolean;
      isDefault?: boolean;
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

  resolveDefault(isMaster = false) {
    return this.api.get<any>(`${this.basePath(isMaster)}/default`);
  }
}
