import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchResourceUiService {
  private readonly api = inject(ApiService);

  list(resource: string, params: { search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return this.api.get<any>(`voip/softswitch/${resource}${suffix ? `?${suffix}` : ''}`);
  }

  create(resource: string, payload: Record<string, unknown>) {
    return this.api.post<any>(`voip/softswitch/${resource}`, payload);
  }

  update(resource: string, uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`voip/softswitch/${resource}/${uuid}`, payload);
  }

  remove(resource: string, uuid: string) {
    return this.api.delete<any>(`voip/softswitch/${resource}/${uuid}`);
  }

  removeMany(resource: string, ids: string[]) {
    return this.api.delete<any>(`voip/softswitch/${resource}/bulk`, { ids });
  }
}
