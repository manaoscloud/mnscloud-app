import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipPabxMediaFileItem = {
  uuid: string;
  id: string;
  pabxUUID?: string | null;
  pabxName?: string | null;
  name: string;
  description?: string | null;
  storageMode: 'default' | 'filesystem' | 'storage';
  storageAccountUUID?: string | null;
  storageAccountName?: string | null;
  storageProvider?: string | null;
  deliveryMode: 'default' | 'online' | 'offline';
  originalFilename?: string | null;
  storedFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageObjectKey?: string | null;
  version?: number | null;
  storageStatus?: string | null;
  enabled: number;
  dateCreated?: string | null;
  dateUpdated?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxMediaFilesService {
  private readonly api = inject(ApiService);
  private readonly endpoint = 'voip/pabx/media-files';

  list(
    params: {
      search?: string;
      status?: string;
      limit?: number;
      offset?: number;
      pabxUUID?: string;
    } = {},
  ) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status !== undefined && params.status !== '') query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.pabxUUID) query.set('pabxUUID', params.pabxUUID);
    const suffix = query.toString();
    return this.api.get<any>(`${this.endpoint}${suffix ? `?${suffix}` : ''}`);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<any>(this.endpoint, payload);
  }

  update(uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`${this.endpoint}/${uuid}`, payload);
  }

  upload(uuid: string, file: File) {
    const data = new FormData();
    data.append('file', file, file.name);
    return this.api.post<any>(`${this.endpoint}/${uuid}/upload`, data);
  }

  uploadWithProgress(uuid: string, file: File) {
    const data = new FormData();
    data.append('file', file, file.name);
    return this.api.postFormWithProgress<any>(`${this.endpoint}/${uuid}/upload`, data);
  }

  playbackUrl(uuid: string) {
    return this.api.get<any>(`${this.endpoint}/${uuid}/playback`);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`${this.endpoint}/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>(`${this.endpoint}/bulk`, { ids });
  }
}
