import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import { VoipSoftswitchServerService } from '../server/server.service';

export type SoftswitchDashboardServer = {
  uuid: string;
  name: string;
  engine: string;
  hostname: string;
  status: number;
  health: 'online' | 'offline' | 'inactive';
  lastSeenAt?: string | null;
};

export type SoftswitchDashboardSnapshot = {
  servers: SoftswitchDashboardServer[];
  accounts: number;
  activeAccounts: number;
  subscribers: number;
  activeSubscribers: number;
  dids: number;
  activeDids: number;
  trunks: number;
  activeTrunks: number;
  routes: number;
  activeRoutes: number;
  cdrs: number;
};

const EMPTY_SNAPSHOT: SoftswitchDashboardSnapshot = {
  servers: [],
  accounts: 0,
  activeAccounts: 0,
  subscribers: 0,
  activeSubscribers: 0,
  dids: 0,
  activeDids: 0,
  trunks: 0,
  activeTrunks: 0,
  routes: 0,
  activeRoutes: 0,
  cdrs: 0,
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchDashboardService {
  private readonly api = inject(ApiService);
  private readonly servers = inject(VoipSoftswitchServerService);
  private readonly listLimit = 5000;

  async get(isMaster = false): Promise<SoftswitchDashboardSnapshot> {
    const [accounts, servers] = await Promise.all([
      isMaster ? [] : this.safeEndpointItems('voip/softswitch/accounts'),
      this.safeItems(this.servers.list(isMaster, { limit: this.listLimit })),
    ]);

    const tenantOnly = isMaster
      ? {
          subscribers: [],
          dids: [],
          trunks: [],
          routes: [],
          cdrs: [],
        }
      : {
          subscribers: await this.safeEndpointItems('voip/softswitch/subscribers'),
          dids: await this.safeEndpointItems('voip/softswitch/dids'),
          trunks: await this.safeEndpointItems('voip/softswitch/trunks'),
          routes: await this.safeEndpointItems('voip/softswitch/routes'),
          cdrs: await this.safeEndpointItems('voip/softswitch/cdrs'),
        };

    return {
      ...EMPTY_SNAPSHOT,
      servers: servers.map((server: any) => this.serverRow(server)),
      accounts: accounts.length,
      activeAccounts: accounts.filter((item: any) => Number(item.VssIsActive ?? 0) === 1).length,
      subscribers: tenantOnly.subscribers.length,
      activeSubscribers: tenantOnly.subscribers.filter(
        (item: any) => Number(item.VsuEnabled ?? 0) === 1,
      ).length,
      dids: tenantOnly.dids.length,
      activeDids: tenantOnly.dids.filter((item: any) => Number(item.VsdEnabled ?? 0) === 1).length,
      trunks: tenantOnly.trunks.length,
      activeTrunks: tenantOnly.trunks.filter((item: any) => this.status(item) === 1).length,
      routes: tenantOnly.routes.length,
      activeRoutes: tenantOnly.routes.filter((item: any) => this.status(item) === 1).length,
      cdrs: tenantOnly.cdrs.length,
    };
  }

  private async safeItems(request: Promise<any>) {
    try {
      const response = await request;
      return Array.isArray(response?.data?.items) ? response.data.items : [];
    } catch {
      return [];
    }
  }

  private safeEndpointItems(endpoint: string) {
    return this.safeItems(this.api.get<any>(`${endpoint}?limit=${this.listLimit}&offset=0`));
  }

  private serverRow(server: any): SoftswitchDashboardServer {
    const status = Number(server.VsrStatus ?? 0);
    return {
      uuid: String(server.VsrUUID ?? ''),
      name: String(server.VsrName ?? '-'),
      engine: String(server.VsrEngine ?? '-'),
      hostname: String(server.VsrHostname ?? ''),
      status,
      health: status !== 1 ? 'inactive' : server.VsrLastSeenAt ? 'online' : 'offline',
      lastSeenAt: server.VsrLastSeenAt ?? null,
    };
  }

  private status(item: any) {
    return Number(
      item.VstStatus ?? item.VsrStatus ?? item.VspStatus ?? item.VrtStatus ?? item.status ?? 0,
    );
  }
}
