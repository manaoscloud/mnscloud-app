import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type VoipDomainItem = {
  VdmUUID: string;
  VdmID: string;
  VdmName: string;
  VdmStatus: number;
  VdmDateCreated?: string | null;
  VdmDateUpdated?: string | null;
  UserUsrUUID?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipDomainService {
  private readonly api = inject(ApiService);

  list(params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`voip/pabx/domains${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: { name: string; status: number }) {
    return this.api.post<any>('voip/pabx/domains', payload);
  }

  update(uuid: string, payload: { name: string; status: number }) {
    return this.api.put<any>(`voip/pabx/domains/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`voip/pabx/domains/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>('voip/pabx/domains/bulk', { ids });
  }
}
