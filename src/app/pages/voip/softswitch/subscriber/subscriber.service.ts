import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipSoftswitchSubscriberItem = {
  VsuUUID: string;
  VsuID: string;
  VoipSoftswitchAccountVssUUID: string;
  CustomerCusUUID: string;
  VoipDomainVdmUUID: string;
  VsuUsername: string;
  VsuPassword: string;
  VsuCallerIdName?: string | null;
  VsuCallerIdNumber?: string | null;
  VsuContext?: string | null;
  VsuRegisterEnabled: number;
  VsuMaxContacts: number;
  VsuMaxConcurrentCalls: number;
  VsuRecordCalls: number;
  VsuOutboundCid?: string | null;
  VsuCodecs?: string | null;
  VsuParamsJson?: unknown;
  VsuEnabled: number;
  SoftswitchName?: string | null;
  CustomerName?: string | null;
  DomainName?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchSubscriberService {
  private readonly api = inject(ApiService);
  private readonly path = 'voip/softswitch/subscribers';

  list(params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`${this.path}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<any>(this.path, payload);
  }

  update(uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`${this.path}/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`${this.path}/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>(`${this.path}/bulk`, { ids });
  }
}
