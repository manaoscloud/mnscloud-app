import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';

export type CyberSecurityProtectedService = {
  uuid: string;
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  defaultPorts?: unknown;
  logPaths?: unknown;
  crowdsecCollections?: unknown;
  enabled?: number | boolean | string;
  environmentUUID?: string | null;
  dateCreated?: string | null;
  dateUpdated?: string | null;
};

export type CyberSecurityProtectedServicePayload = {
  name: string;
  slug: string;
  description?: string | null;
  defaultPorts: unknown;
  logPaths: unknown;
  crowdsecCollections: unknown;
  enabled: number;
};

@Injectable({ providedIn: 'root' })
export class CyberSecurityServicesService {
  private readonly api = inject(ApiService);

  async list(search = '', limit = 1000) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (search.trim()) params.set('search', search.trim());
    const response = await this.api.get<any>(`cyber-security/services?${params.toString()}`);
    return {
      items: (response?.data?.items ?? []) as CyberSecurityProtectedService[],
      total: Number(response?.data?.total ?? response?.data?.items?.length ?? 0),
    };
  }

  async create(payload: CyberSecurityProtectedServicePayload) {
    return await this.api.post<any>('cyber-security/services', payload);
  }

  async update(uuid: string, payload: CyberSecurityProtectedServicePayload) {
    return await this.api.put<any>(`cyber-security/services/${uuid}`, payload);
  }

  async remove(uuid: string) {
    return await this.api.delete<any>(`cyber-security/services/${uuid}`);
  }

  async removeMany(ids: string[]) {
    return await this.api.delete<any>('cyber-security/services/bulk', { ids });
  }
}
