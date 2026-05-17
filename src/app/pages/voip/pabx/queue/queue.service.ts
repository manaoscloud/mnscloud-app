import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipPabxQueueItem = {
  VpqUUID: string;
  VpqID: string;
  VoipPabxAccountVpaUUID: string;
  VoipDomainVdmUUID?: string | null;
  VpqEngine: string;
  VpqName: string;
  VpqStrategy: string;
  VpqTimeoutSeconds: number;
  VpqRetrySeconds: number;
  VpqMaxWaitSeconds: number;
  VoipPabxMediaFileVmfUUID?: string | null;
  MediaFileName?: string | null;
  MediaFileStorageStatus?: string | null;
  VpqFallbackRouteType?: string | null;
  VpqFallbackRouteTargetUUID?: string | null;
  VpqFallbackRouteTargetValue?: string | null;
  VpqParamsJson?: string | null;
  VpqEnabled: number;
  UserUsrUUID?: string | null;
  VpqDateCreated?: string | null;
  VpqDateUpdated?: string | null;
  PabxName?: string | null;
  DomainName?: string | null;
  ServerName?: string | null;
};

export type VoipPabxQueueMemberItem = {
  VqmUUID?: string;
  VqmID?: string;
  VoipPabxQueueVpqUUID?: string;
  VoipPabxExtensionVpeUUID: string;
  ExtensionUsername?: string | null;
  VqmPenalty: number;
  VqmPriority: number;
  VqmEnabled: number;
  VqmDateCreated?: string | null;
  VqmDateUpdated?: string | null;
  _localUUID?: string;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxQueueService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx/queues';

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

  listMembers(queueUUID: string) {
    return this.api.get<any>(`${this.basePath}/${queueUUID}/members`);
  }

  createMember(queueUUID: string, payload: Record<string, unknown>) {
    return this.api.post<any>(`${this.basePath}/${queueUUID}/members`, payload);
  }

  removeMember(queueUUID: string, memberUUID: string) {
    return this.api.delete<any>(`${this.basePath}/${queueUUID}/members/${memberUUID}`);
  }
}
