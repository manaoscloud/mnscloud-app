import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipBlacklistItem = {
  VbkUUID: string;
  VbkName: string;
  VbkDescription?: string | null;
  VbkEnabled: number;
  NumberCount?: number;
  ActiveNumberCount?: number;
};

export type VoipBlacklistNumberItem = {
  VbnUUID: string;
  VoipBlacklistVbkUUID: string;
  BlacklistName?: string | null;
  VbnNumber: string;
  VbnNormalizedNumber: string;
  VbnMatchType: 'exact' | 'prefix' | 'regex';
  VbnAction: 'reject' | 'busy' | 'hangup';
  VbnCause?: string | null;
  VbnReason?: string | null;
  VbnPriority: number;
  VbnEnabled: number;
};

@Injectable({ providedIn: 'root' })
export class VoipBlacklistUiService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx';

  list(params: { search?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    return this.api.get<any>(`${this.basePath}/blacklists${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: { name: string; description?: string; enabled?: boolean }) {
    return this.api.post<any>(`${this.basePath}/blacklists`, payload);
  }

  update(uuid: string, payload: { name?: string; description?: string; enabled?: boolean }) {
    return this.api.put<any>(`${this.basePath}/blacklists/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`${this.basePath}/blacklists/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>(`${this.basePath}/blacklists/bulk`, { ids });
  }

  listNumbers(blacklistUUID?: string, params: { search?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (blacklistUUID) query.set('blacklistUUID', blacklistUUID);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    return this.api.get<any>(`${this.basePath}/blacklist-numbers?${query.toString()}`);
  }

  createNumber(payload: {
    blacklistUUID: string;
    number: string;
    matchType?: string;
    action?: string;
    cause?: string | null;
    reason?: string | null;
    priority?: number;
    enabled?: boolean;
  }) {
    return this.api.post<any>(`${this.basePath}/blacklist-numbers`, payload);
  }

  updateNumber(uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`${this.basePath}/blacklist-numbers/${uuid}`, payload);
  }

  removeNumber(uuid: string) {
    return this.api.delete<any>(`${this.basePath}/blacklist-numbers/${uuid}`);
  }

  removeManyNumbers(ids: string[]) {
    return this.api.delete<any>(`${this.basePath}/blacklist-numbers/bulk`, { ids });
  }
}
