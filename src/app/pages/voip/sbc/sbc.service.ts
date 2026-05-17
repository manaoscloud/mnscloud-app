import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type SbcResource = 'providers' | 'servers' | 'trunks' | 'routes' | 'policies';

export type SbcRecord = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class VoipSbcService {
  private readonly api = inject(ApiService);

  private basePath(isMaster: boolean, resource: SbcResource) {
    return `${isMaster ? 'system/voip/sbc' : 'voip/sbc'}/${resource}`;
  }

  list(
    resource: SbcResource,
    isMaster = false,
    params: { limit?: number; offset?: number; search?: string } = {},
  ) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(isMaster, resource)}${suffix ? `?${suffix}` : ''}`);
  }

  create(resource: SbcResource, payload: SbcRecord, isMaster = false) {
    return this.api.post<any>(this.basePath(isMaster, resource), payload);
  }

  update(resource: SbcResource, uuid: string, payload: SbcRecord, isMaster = false) {
    return this.api.put<any>(`${this.basePath(isMaster, resource)}/${uuid}`, payload);
  }

  remove(resource: SbcResource, uuid: string, isMaster = false) {
    return this.api.delete<any>(`${this.basePath(isMaster, resource)}/${uuid}`);
  }

  removeMany(resource: SbcResource, ids: string[], isMaster = false) {
    return this.api.delete<any>(`${this.basePath(isMaster, resource)}/bulk`, { ids });
  }
}
