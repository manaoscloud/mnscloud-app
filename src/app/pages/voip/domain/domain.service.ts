import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type VoipDomainItem = {
  VdmUUID: string;
  VdmID: string;
  VdmName: string;
  VdmPurpose: 'pabx' | 'softswitch' | 'sbc';
  VdmStatus: number;
  VdmDateCreated?: string | null;
  VdmDateUpdated?: string | null;
  UserUsrUUID?: string | null;
};

export type VoipDomainScope = 'tenant' | 'master';

@Injectable({ providedIn: 'root' })
export class VoipDomainService {
  private readonly api = inject(ApiService);

  private path(scope: VoipDomainScope = 'tenant') {
    return scope === 'master' ? 'system/voip/domains' : 'voip/domains';
  }

  list(
    params: { search?: string; purpose?: string; limit?: number; offset?: number } = {},
    scope: VoipDomainScope = 'tenant',
  ) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.purpose?.trim()) query.set('purpose', params.purpose.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.path(scope)}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: { name: string; purpose: string; status: number }, scope: VoipDomainScope = 'tenant') {
    return this.api.post<any>(this.path(scope), payload);
  }

  update(
    uuid: string,
    payload: { name: string; purpose: string; status: number },
    scope: VoipDomainScope = 'tenant',
  ) {
    return this.api.put<any>(`${this.path(scope)}/${uuid}`, payload);
  }

  remove(uuid: string, scope: VoipDomainScope = 'tenant') {
    return this.api.delete<any>(`${this.path(scope)}/${uuid}`);
  }

  removeMany(ids: string[], scope: VoipDomainScope = 'tenant') {
    return this.api.delete<any>(`${this.path(scope)}/bulk`, { ids });
  }
}
