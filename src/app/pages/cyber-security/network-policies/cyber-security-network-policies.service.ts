import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';

export type CyberSecurityNetworkPolicy = {
  uuid: string;
  id?: string;
  name: string;
  endpointGroup?: string | null;
  action?: string | null;
  scope?: string | null;
  mode?: string | null;
  priority?: number | null;
  nodeType?: string | null;
  trustedNodeUUID?: string | null;
  trustedNodeName?: string | null;
  networks?: unknown;
  methods?: unknown;
  rateLimitPerMinute?: number | null;
  burst?: number | null;
  reason?: string | null;
  enabled?: number | boolean | string;
  environmentUUID?: string | null;
  dateCreated?: string | null;
  dateUpdated?: string | null;
};

export type CyberSecurityNetworkPolicyPayload = {
  trustedNodeUUID?: string | null;
  name: string;
  endpointGroup: string;
  action: string;
  scope: string;
  mode: string;
  priority: number;
  nodeType: string;
  networks: unknown;
  methods: unknown;
  rateLimitPerMinute?: number | null;
  burst?: number | null;
  reason?: string | null;
  enabled: number;
};

@Injectable({ providedIn: 'root' })
export class CyberSecurityNetworkPoliciesService {
  private readonly api = inject(ApiService);

  async list(search = '', limit = 1000) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (search.trim()) params.set('search', search.trim());
    const response = await this.api.get<any>(
      `cyber-security/network-policies?${params.toString()}`,
    );
    return {
      items: (response?.data?.items ?? []) as CyberSecurityNetworkPolicy[],
      total: Number(response?.data?.total ?? response?.data?.items?.length ?? 0),
    };
  }

  async create(payload: CyberSecurityNetworkPolicyPayload) {
    return await this.api.post<any>('cyber-security/network-policies', payload);
  }

  async update(uuid: string, payload: CyberSecurityNetworkPolicyPayload) {
    return await this.api.put<any>(`cyber-security/network-policies/${uuid}`, payload);
  }

  async remove(uuid: string) {
    return await this.api.delete<any>(`cyber-security/network-policies/${uuid}`);
  }

  async removeMany(ids: string[]) {
    return await this.api.delete<any>('cyber-security/network-policies/bulk', { ids });
  }
}
