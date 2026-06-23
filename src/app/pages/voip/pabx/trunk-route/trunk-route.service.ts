import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

@Injectable({ providedIn: 'root' })
export class VoipPabxTrunkRouteUiService {
  private readonly api = inject(ApiService);

  list(
    resource: string,
    params: {
      search?: string;
      status?: number;
      limit?: number;
      offset?: number;
      pabxUUID?: string;
    } = {},
  ) {
    const query = new URLSearchParams();
    if (params.pabxUUID) query.set('pabxUUID', params.pabxUUID);
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status !== undefined && params.status !== null) query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`voip/pabx/${resource}${suffix ? `?${suffix}` : ''}`);
  }

  listAvailableInboundDids(params: {
    pabxUUID: string;
    includeDidUUID?: string;
    search?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams({ pabxUUID: params.pabxUUID });
    if (params.includeDidUUID) query.set('includeDidUUID', params.includeDidUUID);
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    return this.api.get<any>(`voip/pabx/inbound-routes/available-dids?${query.toString()}`);
  }

  create(resource: string, payload: Record<string, unknown>) {
    return this.api.post<any>(`voip/pabx/${resource}`, payload);
  }

  update(resource: string, uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`voip/pabx/${resource}/${uuid}`, payload);
  }

  remove(resource: string, uuid: string) {
    return this.api.delete<any>(`voip/pabx/${resource}/${uuid}`);
  }

  removeMany(resource: string, ids: string[]) {
    return this.api.delete<any>(`voip/pabx/${resource}/bulk`, { ids });
  }
}
