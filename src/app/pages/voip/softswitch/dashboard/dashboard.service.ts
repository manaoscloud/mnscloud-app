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
};

@Injectable({ providedIn: 'root' })
export class VoipSoftswitchDashboardService {
  private readonly api = inject(ApiService);
  private readonly servers = inject(VoipSoftswitchServerService);
  private readonly listLimit = 5000;

  /** Counts come from the database over every tenant row; the master view only lists servers. */
  async get(isMaster = false): Promise<SoftswitchDashboardSnapshot> {
    const [counts, servers] = await Promise.all([
      isMaster
        ? null
        : this.api.get<{ data?: Partial<SoftswitchDashboardSnapshot> }>(
            'voip/softswitch/dashboard',
            { timeout: 30000 },
          ),
      this.servers.list(isMaster, { limit: this.listLimit }),
    ]);
    const items = Array.isArray(servers?.data?.items) ? servers.data.items : [];
    return {
      ...EMPTY_SNAPSHOT,
      ...(counts?.data ?? {}),
      servers: items.map((server: any) => this.serverRow(server)),
    };
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
}
