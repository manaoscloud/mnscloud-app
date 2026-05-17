import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipPabxExtensionItem = {
  VpeUUID: string;
  VpeID: string;
  VoipPabxAccountVpaUUID: string;
  VoipDomainVdmUUID?: string | null;
  VpeEngine: string;
  VpeUsername: string;
  VpePassword: string;
  VpeCallerIdName?: string | null;
  VpeCallerIdNumber?: string | null;
  VpeContext?: string | null;
  VpeVmEnabled: number;
  VpeVmPassword?: string | null;
  VpeRecordCalls: number;
  VpeOutboundCid?: string | null;
  VpeCodecs?: string | null;
  VpeParamsJson?: unknown;
  VpeEnabled: number;
  UserUsrUUID?: string | null;
  VpeDateCreated?: string | null;
  VpeDateUpdated?: string | null;
  PabxName?: string | null;
  DomainName?: string | null;
  ServerEngine?: string | null;
  VpaDefaultAudioCodecs?: string | null;
  VpaDefaultVideoCodecs?: string | null;
  RequiresDomain?: number;
};

export type VoipPabxExtensionGeneratedCredential = {
  username: string;
  password: string;
  vmPassword?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxExtensionService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx/extensions';

  list(params?: URLSearchParams) {
    const query = params?.toString();
    return this.api.get<any>(`${this.basePath}${query ? `?${query}` : ''}`);
  }

  get(uuid: string) {
    return this.api.get<any>(`${this.basePath}/${uuid}`);
  }

  create(payload: {
    pabxUUID: string;
    username: string;
    password: string;
    callerIdName?: string | null;
    callerIdNumber?: string | null;
    context?: string | null;
    vmEnabled?: boolean;
    vmPassword?: string | null;
    recordCalls?: boolean;
    outboundCid?: string | null;
    codecs?: string | null;
    params?: Record<string, unknown> | null;
    enabled?: boolean;
  }) {
    return this.api.post<any>(this.basePath, payload);
  }

  bulkCreate(payload: {
    pabxUUID: string;
    range?: string;
    rangeStart?: number;
    rangeEnd?: number;
    callerIdName?: string | null;
    callerIdNumber?: string | null;
    context?: string | null;
    vmEnabled?: boolean;
    vmPassword?: string | null;
    recordCalls?: boolean;
    outboundCid?: string | null;
    codecs?: string | null;
    params?: Record<string, unknown> | null;
    enabled?: boolean;
  }) {
    return this.api.post<any>(`${this.basePath}/bulk`, payload);
  }

  update(
    uuid: string,
    payload: {
      pabxUUID?: string;
      username?: string;
      password?: string | null;
      callerIdName?: string | null;
      callerIdNumber?: string | null;
      context?: string | null;
      vmEnabled?: boolean;
      vmPassword?: string | null;
      recordCalls?: boolean;
      outboundCid?: string | null;
      codecs?: string | null;
      params?: Record<string, unknown> | null;
      enabled?: boolean;
    },
  ) {
    return this.api.put<any>(`${this.basePath}/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`${this.basePath}/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>(`${this.basePath}/bulk`, { ids });
  }
}
