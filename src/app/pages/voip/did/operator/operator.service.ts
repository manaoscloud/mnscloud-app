import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipDidOperatorItem = {
  VdoUUID: string;
  VdoID: string;
  VdoName: string;
  VdoNick: string;
  ErpSupplierSupUUID?: string | null;
  SupplierName?: string | null;
  VdoStatus: number;
  VdoDateCreated?: string | null;
  VdoDateUpdated?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipDidOperatorService {
  private readonly api = inject(ApiService);

  private basePath(system = false) {
    return system ? 'system/voip/did/operators' : 'voip/did/operators';
  }

  list(params: { search?: string; status?: number; limit?: number; offset?: number } = {}, system = false) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status !== undefined && params.status !== null) query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(system)}${suffix ? `?${suffix}` : ''}`);
  }

  create(
    payload: { name: string; nick: string; supplierUUID?: string | null; status: number },
    system = false,
  ) {
    return this.api.post<any>(this.basePath(system), payload);
  }

  update(
    uuid: string,
    payload: { name: string; nick: string; supplierUUID?: string | null; status: number },
    system = false,
  ) {
    return this.api.put<any>(`${this.basePath(system)}/${uuid}`, payload);
  }

  remove(uuid: string, system = false) {
    return this.api.delete<any>(`${this.basePath(system)}/${uuid}`);
  }

  removeMany(ids: string[], system = false) {
    return this.api.delete<any>(`${this.basePath(system)}/bulk`, { ids });
  }
}
