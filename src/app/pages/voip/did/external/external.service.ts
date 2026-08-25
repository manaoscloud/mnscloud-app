import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../../services/api.service';

export type VoipDidExternalItem = {
  VddUUID: string;
  VddID: string;
  VddNumber: string;
  VddStatus: number;
  VoipDidOperatorVdoUUID?: string | null;
  OperatorName?: string | null;
  OperatorNick?: string | null;
  VddNotes?: string | null;
  VddOrigin: string;
  VddValidationStatus: string;
  VddBillingStatus: string;
  UserUsrUUID?: string | null;
  TenantName?: string | null;
  VddDateCreated?: string | null;
  VddDateUpdated?: string | null;
};

export type VoipDidExternalPayload = {
  number: string;
  operatorUUID: string;
  status?: number | null;
  notes?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipDidExternalService {
  private readonly api = inject(ApiService);

  private basePath(system = false) {
    return system ? 'system/voip/did/external' : 'voip/did/external';
  }

  list(
    params: {
      search?: string;
      status?: number;
      validationStatus?: string;
      billingStatus?: string;
      limit?: number;
      offset?: number;
    } = {},
    system = false,
  ) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status !== undefined && params.status !== null) {
      query.set('status', String(params.status));
    }
    if (params.validationStatus) query.set('validationStatus', params.validationStatus);
    if (params.billingStatus) query.set('billingStatus', params.billingStatus);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(system)}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: VoipDidExternalPayload) {
    return this.api.post<any>(this.basePath(false), payload);
  }

  update(uuid: string, payload: VoipDidExternalPayload) {
    return this.api.put<any>(`${this.basePath(false)}/${uuid}`, payload);
  }

  remove(uuid: string, system = false) {
    return this.api.delete<any>(`${this.basePath(system)}/${uuid}`);
  }
}
