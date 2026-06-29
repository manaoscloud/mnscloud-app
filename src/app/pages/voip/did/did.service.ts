import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';

export type VoipDidItem = {
  VddUUID: string;
  VddID: string;
  VddNumber: string;
  VddStatus: number;
  VoipDidOperatorVdoUUID: string;
  OperatorName?: string | null;
  VoipDidAssignmentVdaUUID?: string | null;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  IsAvailable?: number;
  UserUsrUUID?: string | null;
  BillingSubscriptionBsuUUID?: string | null;
  VddDateCreated?: string | null;
  VddDateUpdated?: string | null;
};

export type VoipDidBulkCreateResponse = {
  data?: {
    items?: VoipDidItem[];
    skippedExisting?: Array<{ number: string; reason: string }>;
    failed?: Array<{ number: string; message: string }>;
    range?: { start: string; end: string; total: number };
  };
  message?: string;
};

@Injectable({ providedIn: 'root' })
export class VoipDidService {
  private readonly api = inject(ApiService);

  private basePath(system = false) {
    return system ? 'system/voip/did/numbers' : 'voip/did/numbers';
  }

  list(
    params: {
      search?: string;
      status?: number;
      limit?: number;
      offset?: number;
      availableOnly?: boolean;
    } = {},
    system = false,
  ) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status !== undefined && params.status !== null) {
      query.set('status', String(params.status));
    }
    if (params.availableOnly) query.set('availableOnly', 'true');
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(system)}${suffix ? `?${suffix}` : ''}`);
  }

  available(params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath(false)}/available${suffix ? `?${suffix}` : ''}`);
  }

  claim(uuid: string, payload: { customerUUID?: string | null } = {}) {
    return this.api.post<any>(`${this.basePath(false)}/${uuid}/claim`, payload);
  }

  release(uuid: string) {
    return this.api.delete<any>(`${this.basePath(false)}/${uuid}/release`);
  }

  create(payload: { number: string; operatorUUID: string; status: number }, system = false) {
    return this.api.post<any>(this.basePath(system), payload);
  }

  bulkCreate(
    payload: {
      range?: string;
      rangeStart?: string;
      rangeEnd?: string;
      operatorUUID: string;
      status: number;
    },
    system = false,
  ) {
    return this.api.post<VoipDidBulkCreateResponse>(`${this.basePath(system)}/bulk`, payload);
  }

  update(
    uuid: string,
    payload: { number: string; operatorUUID: string; status: number },
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
