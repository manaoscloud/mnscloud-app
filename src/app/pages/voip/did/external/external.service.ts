import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../../services/api.service';

export type VoipDidExternalItem = {
  VddUUID: string;
  VddID: string;
  VddNumber: string;
  VddStatus: number;
  VddOrigin: string;
  VddValidationStatus: string;
  VddBillingStatus: string;
  VddBillingAmount: number;
  VddBillingCurrency: string;
  VddBillingInterval: string;
  VddExternalProviderName?: string | null;
  VddExternalProviderAccount?: string | null;
  VddExternalAllowedSources?: string | null;
  VddExternalRoutingInstructions?: string | null;
  VddValidationToken?: string | null;
  VddValidationExpiresAt?: string | null;
  VddActivatedAt?: string | null;
  VddRejectedReason?: string | null;
  UserUsrUUID?: string | null;
  TenantName?: string | null;
  ValidationAttemptStatus?: string | null;
  VevAttemptCount?: number;
  VevLastAttemptAt?: string | null;
  VevObservedSource?: string | null;
  VevObservedNumber?: string | null;
  VevObservedDomain?: string | null;
  VddDateCreated?: string | null;
  VddDateUpdated?: string | null;
};

export type VoipDidExternalPayload = {
  number?: string;
  providerName: string;
  providerAccount?: string | null;
  allowedSources?: string | null;
  billingAmount?: number | null;
  billingCurrency?: string | null;
  billingInterval?: string | null;
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

  startValidation(uuid: string, payload: { expectedSource?: string; expectedDomain?: string }) {
    return this.api.post<any>(`${this.basePath(false)}/${uuid}/validation/start`, payload);
  }

  setStatus(
    uuid: string,
    payload: { validationStatus: string; billingStatus?: string; reason?: string | null },
  ) {
    return this.api.post<any>(`${this.basePath(true)}/${uuid}/status`, payload);
  }

  remove(uuid: string, system = false) {
    return this.api.delete<any>(`${this.basePath(system)}/${uuid}`);
  }
}
