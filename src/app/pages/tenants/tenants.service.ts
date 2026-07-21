import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';

export interface InviteValidateData {
  InviteEmail: string;
  InviteRole: string;
  EnvironmentUUID: string;
  EnvironmentName: string;
  token?: string;
}

@Injectable({ providedIn: 'root' })
export class TenantsService {
  private api = inject(ApiService);

  validateInviteToken(token: string) {
    return this.api.post<any>('user/access/invites/validate', { token });
  }

  acceptInvite(token: string, userUUID: string) {
    return this.api.post<any>('user/access/invites/accept', { token, userUUID });
  }

  acceptInviteWithProfile(payload: {
    token: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateBirth: string;
    password: string;
  }) {
    return this.api.post<any>('user/access/invites/accept', payload);
  }

  getEnvironmentAccess() {
    return this.api.get<any>('user/access/members');
  }

  listInvites() {
    return this.api.get<any>('user/access/invites');
  }

  resendInvite(inviteUUID: string) {
    return this.api.post<any>(`user/access/invites/${inviteUUID}/resend`, {});
  }
}
