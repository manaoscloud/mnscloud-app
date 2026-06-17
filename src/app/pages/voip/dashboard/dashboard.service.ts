import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';

export type VoipDashboardSummary = {
  domainsTotal?: number;
  domainsActive?: number;
  didTotal?: number;
  didAssigned?: number;
  didExternal?: number;
  didExternalPending?: number;
  pabxAccounts?: number;
  pabxActive?: number;
  pabxExtensions?: number;
  pabxTrunks?: number;
  pabxQueues?: number;
  sbcProviders?: number;
  sbcServers?: number;
  sbcOnline?: number;
  sbcTrunks?: number;
  sbcRoutes?: number;
  softswitchAccounts?: number;
  softswitchActive?: number;
  softswitchServers?: number;
  softswitchOnline?: number;
  softswitchSubscribers?: number;
  softswitchTrunks?: number;
  softswitchRoutes?: number;
  callsTotal?: number;
  callsAnswered?: number;
  callsFailed?: number;
};

export type VoipDashboardModule = {
  module: string;
  label: string;
  primaryValue: number;
  secondaryValue: number;
  health: 'ok' | 'warning' | 'empty' | string;
  status: string;
};

export type VoipDashboardRuntime = {
  component: string;
  online: number;
  total: number;
  status: string;
};

export type VoipDashboardMetric = {
  label: string;
  value: number;
};

export type VoipDashboardData = {
  period: string;
  startAt?: string | null;
  generatedAt?: string | null;
  summary: VoipDashboardSummary;
  modules: VoipDashboardModule[];
  runtimeBreakdown: VoipDashboardRuntime[];
  callBreakdown: VoipDashboardMetric[];
};

@Injectable({ providedIn: 'root' })
export class VoipDashboardService {
  private readonly api = inject(ApiService);

  get(period = 'today', system = false) {
    const query = new URLSearchParams();
    query.set('period', period);
    const basePath = system ? 'system/voip/dashboard' : 'voip/dashboard';
    return this.api.get<{ data: VoipDashboardData }>(`${basePath}?${query.toString()}`);
  }
}
