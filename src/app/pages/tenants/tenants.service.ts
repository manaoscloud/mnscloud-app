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

  // LISTA ACESSOS DO USUÁRIO LOGADO
  getMyAccessList() {
    // Usa a rota que retorna todos os ambientes aos quais o usuário tem acesso
    return this.api.get<any>('user/access');
  }

  // OWNER / ADMIN → convida usuário
  inviteUser(payload: { email: string; role: string }) {
    return this.api.post<any>('user/access/invites', payload);
  }

  // Fluxo público → valida token
  validateInviteToken(token: string) {
    return this.api.post<any>('user/access/invites/validate', { token });
  }

  // Fluxo público → aceita convite (token + userUUID)
  acceptInvite(token: string, userUUID: string) {
    return this.api.post<any>('user/access/invites/accept', { token, userUUID });
  }

  // Fluxo público → aceita convite (token + dados completos)
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

  // Remove acesso (OWNER / ADMIN)
  deleteAccess(accessUUID: string) {
    return this.api.delete<any>(`user/access/${accessUUID}`);
  }

  // Lista acessos do ambiente atual (OWNER/ADMIN)
  getEnvironmentAccess() {
    return this.api.get<any>('user/access/members');
  }

  // 🔹 NOVO — lista convites do ambiente atual
  listInvites() {
    // GET /user/access/invites
    return this.api.get<any>('user/access/invites');
  }

  // 🔹 NOVO — cancela convite específico
  cancelInvite(inviteUUID: string) {
    // DELETE /user/access/invites/:uuid
    return this.api.delete<any>(`user/access/invites/${inviteUUID}`);
  }

  // 🔹 NOVO — reenvia convite específico
  resendInvite(inviteUUID: string) {
    // POST /user/access/invites/:uuid/resend
    return this.api.post<any>(`user/access/invites/${inviteUUID}/resend`, {});
  }

  // 🔹 NOVO — define tenant default do usuário atual
  setDefaultAccess(environmentUUID: string) {
    return this.api.post<any>('user/access/default', { environmentUUID });
  }
}
