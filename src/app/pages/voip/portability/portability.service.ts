import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type VoipPortabilityItem = {
  VoipPortabilityUUID: string;
  VoipPortabilityID: string;
  CustomerCusUUID: string;
  CustomerName?: string | null;
  SupportTicketStkUUID: string;
  SupportTicketID?: string | null;
  DonorVoipDidOperatorVdoUUID: string;
  DonorOperatorName?: string | null;
  RecipientVoipDidOperatorVdoUUID: string;
  RecipientOperatorName?: string | null;
  Number: string;
  Direction: string;
  Status: string;
  Reason?: string | null;
  Notes?: string | null;
  RequestedAt?: string | null;
  ScheduledAt?: string | null;
  ConfirmedAt?: string | null;
  CompletedAt?: string | null;
  DateCreated?: string | null;
  DateUpdated?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipPortabilityService {
  private readonly api = inject(ApiService);

  list(params?: Record<string, string | number | null | undefined>) {
    const searchParams = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      searchParams.set(key, String(value));
    });
    const query = searchParams.toString();
    return this.api.get<any>(`voip/portability${query ? `?${query}` : ''}`);
  }

  create(payload: {
    customerUUID: string;
    number: string;
    direction: string;
    donorOperatorUUID: string;
    recipientOperatorUUID: string;
    status?: string | null;
    requestedAt?: string | null;
    scheduledAt?: string | null;
    confirmedAt?: string | null;
    completedAt?: string | null;
    reason?: string | null;
    notes?: string | null;
  }) {
    return this.api.post<any>('voip/portability', payload);
  }

  update(
    uuid: string,
    payload: {
      customerUUID?: string | null;
      number?: string | null;
      direction?: string | null;
      donorOperatorUUID?: string | null;
      recipientOperatorUUID?: string | null;
      status?: string | null;
      requestedAt?: string | null;
      scheduledAt?: string | null;
      confirmedAt?: string | null;
      completedAt?: string | null;
      reason?: string | null;
      notes?: string | null;
    },
  ) {
    return this.api.put<any>(`voip/portability/${uuid}`, payload);
  }

  remove(uuid: string) {
    return this.api.delete<any>(`voip/portability/${uuid}`);
  }

  removeMany(ids: string[]) {
    return this.api.delete<any>('voip/portability/bulk', { ids });
  }
}
