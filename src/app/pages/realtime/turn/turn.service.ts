import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type TurnRecord = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class RealtimeTurnService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'system/realtime/turn/servers';

  list(params: { status?: number | null; limit?: number; offset?: number; search?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status !== undefined && params.status !== null)
      query.set('status', String(params.status));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: TurnRecord) {
    return this.api.post<any>(this.basePath, payload);
  }

  update(uuid: string, payload: TurnRecord) {
    return this.api.put<any>(`${this.basePath}/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`${this.basePath}/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>(`${this.basePath}/bulk`, { ids });
  }

  generateInstallCommand(uuid: string) {
    return this.api.post<any>(`${this.basePath}/${uuid}/install-command`, {});
  }
}
