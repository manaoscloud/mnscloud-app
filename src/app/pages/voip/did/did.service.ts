import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type VoipDidItem = {
  VddUUID: string;
  VddID: string;
  VddNumber: string;
  VddStatus: number;
  VoipDidOperatorVdoUUID: string;
  OperatorName?: string | null;
  VoipDidCustomerVdcUUID?: string | null;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  IsAvailable?: number;
  UserUsrUUID?: string | null;
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

  list(params: { search?: string; limit?: number; offset?: number; availableOnly?: boolean } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.availableOnly) query.set('availableOnly', 'true');
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`voip/did/numbers${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: { number: string; operatorUUID: string; status: number }) {
    return this.api.post<any>('voip/did/numbers', payload);
  }

  bulkCreate(payload: {
    range?: string;
    rangeStart?: string;
    rangeEnd?: string;
    operatorUUID: string;
    status: number;
  }) {
    return this.api.post<VoipDidBulkCreateResponse>('voip/did/numbers/bulk', payload);
  }

  update(uuid: string, payload: { number: string; operatorUUID: string; status: number }) {
    return this.api.put<any>(`voip/did/numbers/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`voip/did/numbers/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>('voip/did/numbers/bulk', { ids });
  }
}
