import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';

export type VoipSoftswitchAccount = {
  VssUUID: string;
  VssID: string;
  VssName: string;
  VoipSoftswitchServerVsrUUID?: string | null;
  VoipDomainVdmUUID?: string | null;
  CustomerCusUUID?: string | null;
  VssConfig?: unknown;
  VssIsActive: number;
  VssIsDefault: number;
  ServerName?: string | null;
  ServerHostname?: string | null;
  DomainName?: string | null;
  CustomerName?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchAccountLookupService {
  private readonly api = inject(ApiService);

  listActive(params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    query.set('status', '1');
    query.set('limit', String(params.limit ?? 500));
    query.set('offset', String(params.offset ?? 0));
    if (params.search?.trim()) query.set('search', params.search.trim());
    return this.api.get<any>(`voip/softswitch/accounts?${query.toString()}`);
  }
}
