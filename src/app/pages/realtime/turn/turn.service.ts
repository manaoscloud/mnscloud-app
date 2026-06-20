import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type TurnRecord = Record<string, any>;
export type TurnResource = 'servers' | 'domains';
export type TurnScope = 'tenant' | 'master';

@Injectable({ providedIn: 'root' })
export class RealtimeTurnService {
  private readonly api = inject(ApiService);
  private readonly systemBasePath = 'system/realtime/turn';
  private readonly tenantBasePath = 'realtime/turn';

  private resourcePath(resource: TurnResource, scope: TurnScope = 'master') {
    if (scope === 'master') return `${this.systemBasePath}/${resource}`;
    if (resource === 'domains') return `${this.tenantBasePath}/domains`;
    throw new Error('TURN/STUN servers are available only from the system scope.');
  }

  list(
    resource: TurnResource = 'servers',
    params: { status?: number | null; limit?: number; offset?: number; search?: string } = {},
    scope: TurnScope = 'master',
  ) {
    const query = new URLSearchParams();
    if (params.status !== undefined && params.status !== null)
      query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString();
    return this.api.get<any>(`${this.resourcePath(resource, scope)}${suffix ? `?${suffix}` : ''}`);
  }

  create(resource: TurnResource, payload: TurnRecord, scope: TurnScope = 'master') {
    return this.api.post<any>(this.resourcePath(resource, scope), payload);
  }

  update(resource: TurnResource, uuid: string, payload: TurnRecord, scope: TurnScope = 'master') {
    return this.api.put<any>(`${this.resourcePath(resource, scope)}/${uuid}`, payload);
  }

  remove(resource: TurnResource, uuid: string, scope: TurnScope = 'master') {
    return this.api.delete<any>(`${this.resourcePath(resource, scope)}/${uuid}`);
  }

  removeMany(resource: TurnResource, ids: string[], scope: TurnScope = 'master') {
    return this.api.delete<any>(`${this.resourcePath(resource, scope)}/bulk`, { ids });
  }

  generateInstallCommand(uuid: string) {
    return this.api.post<any>(`${this.systemBasePath}/servers/${uuid}/install-command`, {});
  }

  provisionDomain(uuid: string, scope: TurnScope = 'master') {
    const basePath = scope === 'master' ? this.systemBasePath : this.tenantBasePath;
    return this.api.post<any>(`${basePath}/domains/${uuid}/provision`, {});
  }

  listServerOptions(scope: TurnScope = 'master') {
    const basePath = scope === 'master' ? this.systemBasePath : this.tenantBasePath;
    return this.api.get<any>(`${basePath}/server-options`);
  }

  listRealtimeDomains(
    params: { purpose?: string; status?: number; limit?: number; search?: string } = {},
    scope: TurnScope = 'master',
  ) {
    if (scope !== 'master') {
      throw new Error('Realtime domain lookup is available only from the system scope.');
    }
    const query = new URLSearchParams();
    if (params.purpose) query.set('purpose', params.purpose);
    if (params.status !== undefined && params.status !== null)
      query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString();
    return this.api.get<any>(`system/realtime/domains${suffix ? `?${suffix}` : ''}`);
  }

  listTurnDomainOptions(scope: TurnScope = 'master') {
    return this.list('domains', { status: 1, limit: 5000 }, scope);
  }
}
