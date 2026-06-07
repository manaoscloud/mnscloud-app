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

  getMyAccessList() {
    return this.api.get<any>('user/access');
  }

  inviteUser(payload: { email: string; role: string }) {
    return this.api.post<any>('user/access/invites', payload);
  }

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

  deleteAccess(accessUUID: string) {
    return this.api.delete<any>(`user/access/${accessUUID}`);
  }

  getEnvironmentAccess() {
    return this.api.get<any>('user/access/members');
  }

  listInvites() {
    return this.api.get<any>('user/access/invites');
  }

  cancelInvite(inviteUUID: string) {
    return this.api.delete<any>(`user/access/invites/${inviteUUID}`);
  }

  resendInvite(inviteUUID: string) {
    return this.api.post<any>(`user/access/invites/${inviteUUID}/resend`, {});
  }

  setDefaultAccess(environmentUUID: string) {
    return this.api.post<any>('user/access/default', { environmentUUID });
  }
}
