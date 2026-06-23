import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';

export type RealtimeDashboardRecord = Record<string, any>;

type ListParams = {
  status?: number | null;
  limit?: number;
  offset?: number;
  search?: string;
};

@Injectable({ providedIn: 'root' })
export class RealtimeDashboardService {
  private readonly api = inject(ApiService);

  listDomains(params: ListParams & { purpose?: string } = {}) {
    return this.api.get<any>(`system/realtime/domains${this.query(params)}`);
  }

  listMediaServers(params: ListParams = {}) {
    return this.api.get<any>(`system/realtime/media/servers${this.query(params)}`);
  }

  listTurnServers(params: ListParams = {}) {
    return this.api.get<any>(`system/realtime/turn/servers${this.query(params)}`);
  }

  listTurnDomains(params: ListParams = {}) {
    return this.api.get<any>(`system/realtime/turn/domains${this.query(params)}`);
  }

  private query(params: ListParams & { purpose?: string }) {
    const query = new URLSearchParams();
    if (params.status !== undefined && params.status !== null)
      query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    if (params.purpose) query.set('purpose', params.purpose);
    const suffix = query.toString();
    return suffix ? `?${suffix}` : '';
  }
}
