// ==========================================================
// Service: tenant.service.ts
// ----------------------------------------------------------
// Responsável por carregar a lista de tenants (environments)
// do usuário autenticado e armazenar o tenant selecionado.
// Usa ApiService (com JWT) e expõe Signals.
// ==========================================================

import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface TenantAccess {
  EnvironmentUUID: string;
  EnvironmentName: string;
  Role: string;
  Status: number;
  IsDefault?: number;
}

interface UserAccessApiResponse {
  status: string;
  message: string;
  data?: {
    access?: TenantAccess[];
  };
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly api = inject(ApiService);

  // Lista completa de tenants disponíveis
  readonly tenants = signal<TenantAccess[]>([]);

  // Tenant selecionado no momento
  readonly selectedTenant = signal<TenantAccess | null>(null);

  // Estado de carregamento
  readonly loading = signal<boolean>(false);

  // Chave única usada também pelo ApiService para enviar o header
  private readonly LS_KEY = 'mc_current_env';

  // ----------------------------------------------------------
  // Carrega tenants do backend
  // ----------------------------------------------------------
  async loadTenants(): Promise<void> {
    this.loading.set(true);

    try {
      const res = await this.api.get<UserAccessApiResponse>('user/access');

      const list = res?.data?.access ?? [];
      this.tenants.set(list);

      // Recupera tenant previamente salvo
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(this.LS_KEY) : null;

      if (saved) {
        const found = list.find((t: TenantAccess) => t.EnvironmentUUID === saved);

        if (found) {
          this.selectedTenant.set(found);
          return;
        }
      }

      const defaultTenant = list.find((t: TenantAccess) => Number(t.IsDefault ?? 0) === 1) ?? null;

      if (list.length > 0) {
        const target = defaultTenant ?? list[0];
        this.selectedTenant.set(target);

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.LS_KEY, target.EnvironmentUUID);
        }
      }
    } catch (err) {
      console.error('❌ Failed to load tenants (user/access)', err);
      this.tenants.set([]);
      this.selectedTenant.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  // ----------------------------------------------------------
  // Troca de tenant manual
  // ----------------------------------------------------------
  setTenant(env: TenantAccess) {
    this.selectedTenant.set(env);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.LS_KEY, env.EnvironmentUUID);
    }
  }
}
