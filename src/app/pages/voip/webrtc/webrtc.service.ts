import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type WebRtcResource = 'servers' | 'parameters' | 'domains';

export type WebRtcRecord = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class VoipWebRtcService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/webrtc';
  private readonly systemBasePath = 'system/voip/webrtc';

  private resourcePath(resource: WebRtcResource) {
    if (resource === 'servers' || resource === 'parameters') {
      return `${this.systemBasePath}/${resource}`;
    }
    return `${this.basePath}/${resource}`;
  }

  list(
    resource: WebRtcResource,
    params: { limit?: number; offset?: number; search?: string } = {},
  ) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString();
    return this.api.get<any>(`${this.resourcePath(resource)}${suffix ? `?${suffix}` : ''}`);
  }

  listServerOptions() {
    return this.api.get<any>(`${this.basePath}/server-options`);
  }

  create(resource: WebRtcResource, payload: WebRtcRecord) {
    return this.api.post<any>(this.resourcePath(resource), payload);
  }

  update(resource: WebRtcResource, uuid: string, payload: WebRtcRecord) {
    return this.api.put<any>(`${this.resourcePath(resource)}/${uuid}`, payload);
  }

  remove(resource: WebRtcResource, uuid: string) {
    return this.api.delete<any>(`${this.resourcePath(resource)}/${uuid}`);
  }

  removeMany(resource: WebRtcResource, ids: string[]) {
    return this.api.delete<any>(`${this.resourcePath(resource)}/bulk`, { ids });
  }

  provisionDomain(uuid: string) {
    return this.api.post<any>(`${this.basePath}/domains/${uuid}/provision`, {});
  }
}
