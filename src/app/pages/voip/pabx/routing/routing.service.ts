import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type PabxRoutingResource = 'external' | 'group' | 'queue' | 'ivr';

@Injectable({ providedIn: 'root' })
export class VoipPabxRoutingService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx';

  list(resource: PabxRoutingResource, params?: URLSearchParams) {
    const query = params?.toString();
    return this.api.get<any>(`${this.basePath}/${resource}${query ? `?${query}` : ''}`);
  }

  get(resource: PabxRoutingResource, uuid: string) {
    return this.api.get<any>(`${this.basePath}/${resource}/${uuid}`);
  }

  create(resource: PabxRoutingResource, payload: Record<string, unknown>) {
    return this.api.post<any>(`${this.basePath}/${resource}`, payload);
  }

  update(resource: PabxRoutingResource, uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`${this.basePath}/${resource}/${uuid}`, payload);
  }

  remove(resource: PabxRoutingResource, uuid: string) {
    return this.api.delete<any>(`${this.basePath}/${resource}/${uuid}`);
  }

  removeMany(resource: PabxRoutingResource, ids: string[]) {
    return this.api.delete<any>(`${this.basePath}/${resource}/bulk`, { ids });
  }

  listMembers(type: 'group' | 'queue', uuid: string) {
    return this.api.get<any>(`${this.basePath}/${type}/${uuid}/members`);
  }

  createMember(type: 'group' | 'queue', uuid: string, payload: Record<string, unknown>) {
    return this.api.post<any>(`${this.basePath}/${type}/${uuid}/members`, payload);
  }

  removeMember(type: 'group' | 'queue', uuid: string, memberUuid: string) {
    return this.api.delete<any>(`${this.basePath}/${type}/${uuid}/members/${memberUuid}`);
  }

  listIvrOptions(uuid: string) {
    return this.api.get<any>(`${this.basePath}/ivr/${uuid}/options`);
  }

  createIvrOption(uuid: string, payload: Record<string, unknown>) {
    return this.api.post<any>(`${this.basePath}/ivr/${uuid}/options`, payload);
  }

  removeIvrOption(uuid: string, optionUuid: string) {
    return this.api.delete<any>(`${this.basePath}/ivr/${uuid}/options/${optionUuid}`);
  }
}
