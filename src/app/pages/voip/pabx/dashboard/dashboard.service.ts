import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type PabxDashboardMetric = {
  label: string;
  value: number | null;
};

export type PabxDashboardServer = {
  serverUUID: string;
  name: string;
  engine: string;
  hostname?: string | null;
  status: number;
  lastSeenAt?: string | null;
  health: 'online' | 'offline' | 'inactive' | 'unknown' | string;
  pabxAccounts: number;
};

export type PabxDashboardQueue = {
  queueUUID: string;
  name: string;
  pabxName: string;
  strategy: string;
  status: number;
  members: number;
  availableAgents: number | null;
  pausedAgents: number | null;
};

export type PabxDashboardTrunk = {
  trunkUUID: string;
  name: string;
  pabxName: string;
  direction: string;
  host: string;
  transport: string;
  status: number;
};

export type PabxDashboardSummary = {
  serversTotal?: number;
  serversOnline?: number;
  pabxAccounts?: number;
  extensionsTotal?: number;
  extensionsActive?: number;
  trunksTotal?: number;
  trunksActive?: number;
  queuesTotal?: number;
  agentsAvailable?: number;
  agentsPaused?: number;
  agentsLoggedOut?: number;
  callsTotal?: number;
  callsAnswered?: number;
};

export type PabxDashboardData = {
  period: string;
  startAt?: string | null;
  generatedAt?: string | null;
  summary: PabxDashboardSummary;
  servers: PabxDashboardServer[];
  queues: PabxDashboardQueue[];
  trunks: PabxDashboardTrunk[];
  callBreakdown: PabxDashboardMetric[];
  agentBreakdown: PabxDashboardMetric[];
};

export type PabxDashboardFilters = {
  period?: string;
  pabxUUID?: string;
  serverUUID?: string;
  domainUUID?: string;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxDashboardService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'voip/pabx/dashboard';

  get(filters: PabxDashboardFilters = {}) {
    const query = new URLSearchParams();
    if (filters.period) query.set('period', filters.period);
    if (filters.pabxUUID) query.set('pabxUUID', filters.pabxUUID);
    if (filters.serverUUID) query.set('serverUUID', filters.serverUUID);
    if (filters.domainUUID) query.set('domainUUID', filters.domainUUID);
    const suffix = query.toString();
    return this.api.get<{ data: PabxDashboardData }>(
      `${this.basePath}${suffix ? `?${suffix}` : ''}`,
    );
  }
}
