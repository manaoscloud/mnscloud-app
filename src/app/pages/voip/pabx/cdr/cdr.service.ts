import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type PabxCdrKind = 'all' | 'asterisk' | 'freeswitch';

@Injectable({ providedIn: 'root' })
export class VoipPabxCdrService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx/cdr';

  list(kind: PabxCdrKind, params: URLSearchParams) {
    const query = params.toString();
    const suffix = kind === 'all' ? '' : `/${kind}`;
    return this.api.get<any>(`${this.basePath}${suffix}${query ? `?${query}` : ''}`);
  }

  recordingUrl(engine: string, cdrUUID: string) {
    return this.api.get<any>(
      `${this.basePath}/recording/${encodeURIComponent(engine)}/${encodeURIComponent(cdrUUID)}`,
    );
  }
}
