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
        return this.api.post<any>('user/access/invite', payload);
    }

    // Fluxo público → valida token
    validateInviteToken(token: string) {
        return this.api.post<any>('user/access/invite/validate', { token });
    }

    // Fluxo público → aceita convite (token + userUUID)
    acceptInvite(token: string, userUUID: string) {
        return this.api.post<any>('user/access/accept', { token, userUUID });
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
        return this.api.post<any>('user/access/accept', payload);
    }

    // Remove acesso (OWNER / ADMIN)
    deleteAccess(accessUUID: string) {
        return this.api.delete<any>(`user/access/${accessUUID}`);
    }

    // Lista acessos do ambiente atual (OWNER/ADMIN)
    getEnvironmentAccess() {
        return this.api.get<any>('user/access/environment');
    }

    // 🔹 NOVO — lista convites do ambiente atual
    getInvites() {
        // GET /user/access/invite
        return this.api.get<any>('user/access/invite');
    }

    // 🔹 NOVO — cancela convite específico
    cancelInvite(inviteUUID: string) {
        // DELETE /user/access/invite/:uuid
        return this.api.delete<any>(`user/access/invite/${inviteUUID}`);
    }

    // 🔹 NOVO — reenvia convite específico
    resendInvite(inviteUUID: string) {
        // POST /user/access/invite/:uuid/resend
        return this.api.post<any>(`user/access/invite/${inviteUUID}/resend`, {});
    }

    // 🔹 NOVO — define tenant default do usuário atual
    setDefaultAccess(environmentUUID: string) {
        return this.api.post<any>('user/access/default', { environmentUUID });
    }
}
