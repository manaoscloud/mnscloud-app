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

  list(params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`voip/did/operators${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: { name: string; nick: string; supplierUUID?: string | null; status: number }) {
    return this.api.post<any>('voip/did/operators', payload);
  }

  update(
    uuid: string,
    payload: { name: string; nick: string; supplierUUID?: string | null; status: number },
  ) {
    return this.api.put<any>(`voip/did/operators/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`voip/did/operators/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>('voip/did/operators/bulk', { ids });
  }
}
