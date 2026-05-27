import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';

export type CyberSecurityTrustedNode = {
  uuid: string;
  id?: string;
  name: string;
  nodeUUID?: string | null;
  nodeType?: string | null;
  hostname?: string | null;
  allowedNetworks?: unknown;
  endpointGroups?: unknown;
  authMode?: string | null;
  secretVersion?: number | null;
  status?: string | null;
  mode?: string | null;
  lastSeenAt?: string | null;
  lastSeenIP?: string | null;
  notes?: string | null;
  environmentUUID?: string | null;
  dateCreated?: string | null;
  dateUpdated?: string | null;
};

export type CyberSecurityTrustedNodePayload = {
  name: string;
  nodeUUID: string;
  nodeType: string;
  hostname?: string | null;
  allowedNetworks: unknown;
  endpointGroups: unknown;
  authMode: string;
  secret?: string;
  status: string;
  mode: string;
  notes?: string | null;
};

@Injectable({ providedIn: 'root' })
export class CyberSecurityTrustedNodesService {
  private readonly api = inject(ApiService);

  async list(search = '', limit = 1000) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (search.trim()) params.set('search', search.trim());
    const response = await this.api.get<any>(`cyber-security/trusted-nodes?${params.toString()}`);
    return {
      items: (response?.data?.items ?? []) as CyberSecurityTrustedNode[],
      total: Number(response?.data?.total ?? response?.data?.items?.length ?? 0),
    };
  }

  async create(payload: CyberSecurityTrustedNodePayload) {
    return await this.api.post<any>('cyber-security/trusted-nodes', payload);
  }

  async update(uuid: string, payload: CyberSecurityTrustedNodePayload) {
    return await this.api.put<any>(`cyber-security/trusted-nodes/${uuid}`, payload);
  }

  async remove(uuid: string) {
    return await this.api.delete<any>(`cyber-security/trusted-nodes/${uuid}`);
  }

  async removeMany(ids: string[]) {
    return await this.api.delete<any>('cyber-security/trusted-nodes/bulk', { ids });
  }
}
