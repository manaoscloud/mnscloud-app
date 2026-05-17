import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';

import { TenantsService } from './tenants.service';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
    selector: 'settings-tenants',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,

        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatCardModule,
    ],
    templateUrl: './tenants.html',
    styleUrl: './tenants.scss',
})
export class SettingsTenantsPage {

    private service = inject(TenantsService);
    private fb = inject(FormBuilder);

    // ======================================================
    // LISTA DE ACESSOS EXISTENTES
    // ======================================================
    loading = signal(true);
    list = signal<any[]>([]);
    error = signal<string | null>(null);
    currentEnvRole = signal<string | null>(null);
    selfLoading = signal(true);
    selfList = signal<any[]>([]);
    selfError = signal<string | null>(null);

    // ======================================================
    // LISTA DE CONVITES
    // ======================================================
    invitesLoading = signal(true);
    invites = signal<any[]>([]);
    invitesError = signal<string | null>(null);

    // ======================================================
    // FORMULÁRIO DE CONVITE
    // ======================================================
    // Roles permitidos para convite (ajustado para ADMIN / USER)
    readonly roles = ['ADMIN', 'USER'];

    inviteForm = this.fb.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        role: ['USER', [Validators.required]],
    });

    inviting = signal(false);
    inviteError = signal<string | null>(null);
    inviteSuccess = signal<string | null>(null);

    get canInvite(): boolean {
        return this.inviteForm.valid && !this.inviting();
    }

    async ngOnInit() {
        // carrega acessos e convites em paralelo
        await Promise.all([
            this.loadAccessList(),
            this.loadInvites(),
        ]);
    }

    // ======================================================
    // LOAD EXISTING ACCESS
    // ======================================================
    private async loadAccessList() {
        this.loading.set(true);
        this.error.set(null);
        this.selfLoading.set(true);
        this.selfError.set(null);

        try {
            // 1) Lista os ambientes aos quais o usuário tem acesso
            const resSelf = await this.service.getMyAccessList();
            const selfList =
                resSelf?.data?.access ??
                resSelf?.data?.getUserAccess ??
                resSelf?.data?.accessList ??
                [];
            this.selfList.set(selfList);

            // Descobre env atual e papel nele
            const currentEnv = typeof localStorage !== 'undefined'
                ? localStorage.getItem('mc_current_env')
                : null;

            const currentRole = selfList.find((item: any) =>
                item.EnvironmentUUID === currentEnv
            )?.Role ?? null;

            this.currentEnvRole.set(currentRole);

            // 2) Se for OWNER/ADMIN do env atual, carrega lista completa do ambiente
            if (currentEnv && ['OWNER', 'ADMIN'].includes(currentRole)) {
                try {
                    const resEnv = await this.service.getEnvironmentAccess();
                    const envList =
                        resEnv?.data?.access ??
                        resEnv?.data?.getUserAccess ??
                        [];
                    this.list.set(envList);
                } catch (innerErr: any) {
                    console.error('getEnvironmentAccess error:', innerErr);
                    // fallback: mostra apenas o próprio acesso
                    this.list.set(selfList);
                }
            } else {
                // Usuário comum: mostra apenas os ambientes que ele participa
                this.list.set(selfList);
            }
        } catch (err: any) {
            console.error('getMyAccessList error:', err);
            const message =
                err?.error?.message ||
                err?.message ||
                'Failed to load access list.';
            this.error.set(message);
            this.selfError.set(message);
        }

        this.loading.set(false);
        this.selfLoading.set(false);
    }

    async remove(uuid: string) {
        if (!confirm('Remove this access?')) return;

        try {
            await this.service.deleteAccess(uuid);
            this.list.update(list => list.filter(i => i.UscUUID !== uuid));
        } catch (err) {
            console.error('deleteAccess error:', err);
            alert('Failed to remove access.');
        }
    }

    // ======================================================
    // LOAD INVITES
    // ======================================================
    private async loadInvites() {
        this.invitesLoading.set(true);
        this.invitesError.set(null);

        try {
            const res = await this.service.getInvites();

            const list =
                res?.data?.invites ??
                res?.data?.getUserAccessInvite ??
                res?.data?.getInvites ??
                [];

            this.invites.set(list);
        } catch (err: any) {
            console.error('getInvites error:', err);
            const message =
                err?.error?.message ||
                err?.message ||
                'Failed to load invitations.';

            // Se for permissão negada (ex.: usuário comum), apenas limpa sem erro visual
            if (message.toLowerCase().includes('permission')) {
                this.invites.set([]);
            } else {
                this.invitesError.set(message);
            }
        }

        this.invitesLoading.set(false);
    }

    async cancelInvite(uuid: string) {
        if (!confirm('Cancel this invitation?')) return;

        try {
            await this.service.cancelInvite(uuid);
            this.invites.update(list => list.filter(i => i.UsiUUID !== uuid));
        } catch (err) {
            console.error('cancelInvite error:', err);
            alert('Failed to cancel invitation.');
        }
    }

    // ======================================================
    // RESEND INVITE
    // ======================================================
    async resendInvite(uuid: string) {
        try {
            await this.service.resendInvite(uuid);
            alert('Invitation resent successfully.');
        } catch (err) {
            console.error('resendInvite error:', err);
            alert('Failed to resend invitation.');
        }
    }

    isDefaultAccess(item: any): boolean {
        return Number(item?.IsDefault ?? item?.UscIsDefault ?? 0) === 1;
    }

    async setDefaultAccess(environmentUUID: string) {
        try {
            await this.service.setDefaultAccess(environmentUUID);
            this.selfList.update(list =>
                list.map(item => ({
                    ...item,
                    IsDefault: item.EnvironmentUUID === environmentUUID ? 1 : 0,
                }))
            );

            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('mc_current_env', environmentUUID);
            }
        } catch (err) {
            console.error('setDefaultAccess error:', err);
            alert('Failed to set default tenant.');
        }
    }

    // ======================================================
    // ENVIAR CONVITE
    // ======================================================
    async sendInvite() {
        if (!this.canInvite) return;

        this.inviting.set(true);
        this.inviteError.set(null);
        this.inviteSuccess.set(null);

        const { email, role } = this.inviteForm.getRawValue();

        try {
            const res = await this.service.inviteUser({ email, role });

            const message =
                res?.message ||
                res?.data?.message ||
                'Invitation sent successfully.';

            this.inviteSuccess.set(message);
            this.inviteForm.reset({
                email: '',
                role: 'USER',
            });

            // recarrega lista de convites após criar um novo
            await this.loadInvites();

        } catch (err: any) {
            console.error('inviteUser error:', err);
            const msg =
                err?.error?.message ||
                err?.error?.error ||
                err?.message ||
                'Failed to send invitation.';

            this.inviteError.set(msg);
        } finally {
            this.inviting.set(false);
        }
    }
}
