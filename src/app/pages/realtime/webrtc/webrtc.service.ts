import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type WebRtcResource = 'servers' | 'parameters' | 'domains';
export type WebRtcScope = 'tenant' | 'master';

export type WebRtcRecord = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class RealtimeWebRtcService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'realtime/webrtc';
  private readonly systemBasePath = 'system/realtime/webrtc';

  private resourcePath(resource: WebRtcResource, scope: WebRtcScope = 'tenant') {
    if (scope === 'master' || resource === 'parameters') {
      return `${this.systemBasePath}/${resource}`;
    }
    return `${this.basePath}/${resource}`;
  }

  list(
    resource: WebRtcResource,
    params: { limit?: number; offset?: number; search?: string; status?: string | number | null } = {},
    scope: WebRtcScope = 'tenant',
  ) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    if (params.status !== undefined && params.status !== null && params.status !== '') {
      query.set('status', String(params.status));
    }
    const suffix = query.toString();
    return this.api.get<any>(`${this.resourcePath(resource, scope)}${suffix ? `?${suffix}` : ''}`);
  }

  listRealtimeDomains(params: { limit?: number; search?: string; purpose?: string } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.purpose) query.set('purpose', params.purpose);
    const suffix = query.toString();
    return this.api.get<any>(`system/realtime/domains${suffix ? `?${suffix}` : ''}`);
  }

  listMediaServers(params: { limit?: number; offset?: number; search?: string; status?: number } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    if (params.status !== undefined && params.status !== null) {
      query.set('status', String(params.status));
    }
    const suffix = query.toString();
    return this.api.get<any>(`system/realtime/media/servers${suffix ? `?${suffix}` : ''}`);
  }

  create(resource: WebRtcResource, payload: WebRtcRecord, scope: WebRtcScope = 'tenant') {
    return this.api.post<any>(this.resourcePath(resource, scope), payload);
  }

  update(
    resource: WebRtcResource,
    uuid: string,
    payload: WebRtcRecord,
    scope: WebRtcScope = 'tenant',
  ) {
    return this.api.put<any>(`${this.resourcePath(resource, scope)}/${uuid}`, payload);
  }

  remove(resource: WebRtcResource, uuid: string, scope: WebRtcScope = 'tenant') {
    return this.api.delete<any>(`${this.resourcePath(resource, scope)}/${uuid}`);
  }

  removeMany(resource: WebRtcResource, ids: string[], scope: WebRtcScope = 'tenant') {
    return this.api.delete<any>(`${this.resourcePath(resource, scope)}/bulk`, { ids });
  }

  provisionDomain(uuid: string, scope: WebRtcScope = 'tenant') {
    const basePath = scope === 'master' ? this.systemBasePath : this.basePath;
    return this.api.post<any>(`${basePath}/domains/${uuid}/provision`, {});
  }

  generateInstallCommand(uuid: string) {
    return this.api.post<any>(`${this.systemBasePath}/servers/${uuid}/install-command`, {});
  }
}
