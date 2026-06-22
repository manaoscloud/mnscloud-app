import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type MediaRecord = Record<string, any>;
export type MediaResource = 'servers';
export type MediaScope = 'master';

@Injectable({ providedIn: 'root' })
export class RealtimeMediaService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'system/realtime/media';

  list(
    _resource: MediaResource = 'servers',
    params: { status?: number | null; limit?: number; offset?: number; search?: string } = {},
    _scope: MediaScope = 'master',
  ) {
    const query = new URLSearchParams();
    if (params.status !== undefined && params.status !== null)
      query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath}/servers${suffix ? `?${suffix}` : ''}`);
  }

  create(_resource: MediaResource, payload: MediaRecord, _scope: MediaScope = 'master') {
    return this.api.post<any>(`${this.basePath}/servers`, payload);
  }

  update(_resource: MediaResource, uuid: string, payload: MediaRecord, _scope: MediaScope = 'master') {
    return this.api.put<any>(`${this.basePath}/servers/${uuid}`, payload);
  }

  remove(_resource: MediaResource, uuid: string, _scope: MediaScope = 'master') {
    return this.api.delete<any>(`${this.basePath}/servers/${uuid}`);
  }

  removeMany(_resource: MediaResource, ids: string[], _scope: MediaScope = 'master') {
    return this.api.delete<any>(`${this.basePath}/servers/bulk`, { ids });
  }

  generateInstallCommand(uuid: string) {
    return this.api.post<any>(`${this.basePath}/servers/${uuid}/install-command`, {});
  }

  listRealtimeDomains(params: { purpose?: string; status?: number; limit?: number; search?: string } = {}) {
    const query = new URLSearchParams();
    if (params.purpose) query.set('purpose', params.purpose);
    if (params.status !== undefined && params.status !== null)
      query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString();
    return this.api.get<any>(`system/realtime/domains${suffix ? `?${suffix}` : ''}`);
  }
}
