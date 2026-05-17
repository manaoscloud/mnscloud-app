import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipDidCustomerLink = {
  VdcUUID: string;
  VdcID: string;
  CustomerCusUUID: string;
  CustomerName?: string | null;
  VoipDidVddUUID: string;
  VddNumber?: string | null;
  VdcStatus: number;
  VdcDateCreated?: string | null;
  VdcDateUpdated?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipDidCustomerService {
  private readonly api = inject(ApiService);

  list(params?: URLSearchParams) {
    const query = params?.toString();
    return this.api.get<any>(`voip/did/customers${query ? `?${query}` : ''}`);
  }

  create(payload: { customerUUID: string; didUUID: string; status: number }) {
    return this.api.post<any>('voip/did/customers', payload);
  }

  update(uuid: string, payload: { customerUUID: string; didUUID: string; status: number }) {
    return this.api.put<any>(`voip/did/customers/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`voip/did/customers/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>('voip/did/customers/bulk', { ids });
  }
}
