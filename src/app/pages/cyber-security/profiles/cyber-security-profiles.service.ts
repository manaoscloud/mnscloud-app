import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';

export type CyberSecurityProfile = {
  uuid: string;
  id?: string;
  name: string;
  description?: string | null;
  mode?: string | null;
  level?: string | null;
  defaultDecisionDuration?: string | null;
  trustedNetworks?: unknown;
  rules?: unknown;
  enabled?: number | boolean | string;
  serviceSlugs?: string | null;
  environmentUUID?: string | null;
  dateCreated?: string | null;
  dateUpdated?: string | null;
};

export type CyberSecurityProfilePayload = {
  name: string;
  description?: string | null;
  mode: string;
  level: string;
  defaultDecisionDuration: string;
  serviceUUIDs: string[];
  trustedNetworks: unknown;
  rules: unknown;
  enabled: number;
};

@Injectable({ providedIn: 'root' })
export class CyberSecurityProfilesService {
  private readonly api = inject(ApiService);

  async list(search = '', limit = 1000) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (search.trim()) params.set('search', search.trim());
    const response = await this.api.get<any>(`cyber-security/profiles?${params.toString()}`);
    return {
      items: (response?.data?.items ?? []) as CyberSecurityProfile[],
      total: Number(response?.data?.total ?? response?.data?.items?.length ?? 0),
    };
  }

  async create(payload: CyberSecurityProfilePayload) {
    return await this.api.post<any>('cyber-security/profiles', payload);
  }

  async update(uuid: string, payload: CyberSecurityProfilePayload) {
    return await this.api.put<any>(`cyber-security/profiles/${uuid}`, payload);
  }

  async remove(uuid: string) {
    return await this.api.delete<any>(`cyber-security/profiles/${uuid}`);
  }

  async removeMany(ids: string[]) {
    return await this.api.delete<any>('cyber-security/profiles/bulk', { ids });
  }
}
