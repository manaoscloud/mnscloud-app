import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type WebRtcDashboardMetric = {
  label: string;
  value: number | null;
};

export type WebRtcDashboardServer = {
  serverUUID: string;
  name: string;
  engine: string;
  hostname?: string | null;
  publicDomain?: string | null;
  publicIP?: string | null;
  version?: string | null;
  status: number;
  lastSeenAt?: string | null;
  health: 'online' | 'offline' | 'inactive' | 'unknown' | string;
  domains: number;
};

export type WebRtcDashboardDomain = {
  domainUUID: string;
  domainName: string;
  serverName: string;
  certificateProvider: string;
  certificateStatus: string;
  nginxStatus: string;
  autoProvision: number;
  status: number;
  lastSyncedAt?: string | null;
  lastError?: string | null;
};

export type WebRtcDashboardSummary = {
  serversTotal?: number;
  serversOnline?: number;
  domainsTotal?: number;
  domainsActive?: number;
  certificatesReady?: number;
  certificatesPending?: number;
  nginxReady?: number;
  nginxPending?: number;
  jobsPending?: number;
  jobsFailed?: number;
  parametersActive?: number;
};

export type WebRtcDashboardData = {
  period: string;
  startAt?: string | null;
  generatedAt?: string | null;
  summary: WebRtcDashboardSummary;
  servers: WebRtcDashboardServer[];
  domains: WebRtcDashboardDomain[];
  certificateBreakdown: WebRtcDashboardMetric[];
  jobBreakdown: WebRtcDashboardMetric[];
};

export type WebRtcDashboardFilters = {
  period?: string;
  serverUUID?: string;
  domainUUID?: string;
};

@Injectable({ providedIn: 'root' })
export class RealtimeWebRtcDashboardService {
  private readonly api = inject(ApiService);

  private basePath(system = false) {
    return system ? 'system/realtime/webrtc/dashboard' : 'realtime/webrtc/dashboard';
  }

  get(filters: WebRtcDashboardFilters = {}, system = false) {
    const query = new URLSearchParams();
    if (filters.period) query.set('period', filters.period);
    if (filters.serverUUID) query.set('serverUUID', filters.serverUUID);
    if (filters.domainUUID) query.set('domainUUID', filters.domainUUID);
    const suffix = query.toString();
    return this.api.get<{ data: WebRtcDashboardData }>(
      `${this.basePath(system)}${suffix ? `?${suffix}` : ''}`,
    );
  }
}
