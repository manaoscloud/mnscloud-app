import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipPabxQueueAgentItem = {
  VqaUUID: string;
  VqaID: string;
  ErpHrEmployeeEmpUUID: string;
  VoipPabxExtensionVpeUUID: string;
  VqaLoginCode: string;
  VqaDisplayName?: string | null;
  VqaRuntimeStatus: 'LOGGED_OUT' | 'AVAILABLE' | 'PAUSED';
  VqaPauseReason?: string | null;
  VqaLastLoginAt?: string | null;
  VqaLastLogoutAt?: string | null;
  VqaLastStatusAt?: string | null;
  VqaEnabled: number;
  EmployeeName?: string | null;
  EmployeeEmail?: string | null;
  ExtensionUsername?: string | null;
  ExtensionCallerIdName?: string | null;
  ExtensionCallerIdNumber?: string | null;
  VoipPabxAccountVpaUUID?: string | null;
  PabxName?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxQueueAgentService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx/queue-agents';

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

  setStatus(uuid: string, action: 'login' | 'logout' | 'pause' | 'unpause', pauseReason?: string) {
    return this.api.post<any>(`${this.basePath}/${uuid}/${action}`, { pauseReason });
  }
}
