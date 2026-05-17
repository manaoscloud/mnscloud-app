import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipPabxIvrItem = {
  VpiUUID: string;
  VpiID: string;
  VoipPabxAccountVpaUUID: string;
  VoipDomainVdmUUID?: string | null;
  VoipPabxMediaFileVmfUUID?: string | null;
  MediaFileName?: string | null;
  MediaFileStorageStatus?: string | null;
  VpiEngine: string;
  VpiName: string;
  VpiGreetingText?: string | null;
  VpiTimeoutSeconds: number;
  VpiInvalidRetries: number;
  VpiTimeoutRouteType?: string | null;
  VpiTimeoutRouteTargetUUID?: string | null;
  VpiTimeoutRouteTargetValue?: string | null;
  VpiInvalidRouteType?: string | null;
  VpiInvalidRouteTargetUUID?: string | null;
  VpiInvalidRouteTargetValue?: string | null;
  VpiParamsJson?: string | null;
  VpiEnabled: number;
  UserUsrUUID?: string | null;
  VpiDateCreated?: string | null;
  VpiDateUpdated?: string | null;
  PabxName?: string | null;
  DomainName?: string | null;
  ServerName?: string | null;
};

export type VoipPabxIvrOptionItem = {
  VioUUID?: string;
  VioID?: string;
  VoipPabxIvrVpiUUID?: string;
  VioDigit: string;
  VioRouteType: string;
  VioRouteTargetUUID?: string | null;
  VioRouteTargetValue?: string | null;
  VioDescription?: string | null;
  VioEnabled: number;
  VioDateCreated?: string | null;
  VioDateUpdated?: string | null;
  _localUUID?: string;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxIvrService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx/ivrs';

  list(params?: URLSearchParams) {
    const query = params?.toString();
    return this.api.get<any>(`${this.basePath}${query ? `?${query}` : ''}`);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<any>(this.basePath, payload);
  }

  update(uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`${this.basePath}/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`${this.basePath}/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>(`${this.basePath}/bulk`, { ids });
  }

  listOptions(ivrUUID: string) {
    return this.api.get<any>(`${this.basePath}/${ivrUUID}/options`);
  }

  createOption(ivrUUID: string, payload: Record<string, unknown>) {
    return this.api.post<any>(`${this.basePath}/${ivrUUID}/options`, payload);
  }

  removeOption(ivrUUID: string, optionUUID: string) {
    return this.api.delete<any>(`${this.basePath}/${ivrUUID}/options/${optionUUID}`);
  }
}
