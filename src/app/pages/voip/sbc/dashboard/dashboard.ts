import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { Component, computed, inject } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';

type SbcMetric = {
  key: string;
  label: string;
  icon: string;
  total: number;
  active: number;
  inactive: number;
  description: string;
};

type SbcReadinessItem = {
  key: string;
  label: string;
  description: string;
  ready: boolean;
  current: number;
  required: number;
};

type SbcInventoryRow = {
  key: string;
  label: string;
  total: number;
  active: number;
  inactive: number;
  coverage: number;
};

type SbcCount = { total: number; active: number };

/** Totals counted by the database over every row in scope (GET {voip|system/voip}/sbc/dashboard). */
type SbcSnapshot = {
  accounts: SbcCount;
  servers: SbcCount;
  interfaces: SbcCount;
  peers: SbcCount;
  pipes: SbcCount;
  manipulations: SbcCount;
};

const SBC_RESOURCES = [
  'accounts',
  'servers',
  'interfaces',
  'peers',
  'pipes',
  'manipulations',
] as const;
const EMPTY_COUNT: SbcCount = { total: 0, active: 0 };
const EMPTY_SNAPSHOT: SbcSnapshot = {
  accounts: EMPTY_COUNT,
  servers: EMPTY_COUNT,
  interfaces: EMPTY_COUNT,
  peers: EMPTY_COUNT,
  pipes: EMPTY_COUNT,
  manipulations: EMPTY_COUNT,
};

@Component({
  selector: 'app-voip-sbc-dashboard',
  standalone: true,
  imports: [MatIconModule, DashboardPageComponent, TranslocoPipe],
  templateUrl: './dashboard.html',
})
export class VoipSbcDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private readonly endpointPrefix =
    this.route.snapshot.data['scope'] === 'master' ? 'system/voip/sbc' : 'voip/sbc';

  readonly snapshotResource = dashboardResource({
    loader: async () => this.loadSnapshot(),
  });

  readonly snapshot = computed(() => this.snapshotResource.value() ?? EMPTY_SNAPSHOT);
  readonly loading = computed(() => this.snapshotResource.isLoading());
  readonly masterScope = computed(() => this.route.snapshot.data['scope'] === 'master');
  readonly metrics = computed<SbcMetric[]>(() => {
    const snapshot = this.snapshot();
    if (this.masterScope()) {
      return [
        this.metric(
          'servers',
          'Runtime nodes',
          'dns',
          snapshot.servers,
          'Authorized SBC runtime servers available to tenants.',
        ),
        this.metric(
          'interfaces',
          'SIP interfaces',
          'settings_input_component',
          snapshot.interfaces,
          'Listening interfaces prepared for inbound and outbound SIP traffic.',
        ),
        this.metric(
          'readiness',
          'Operational readiness',
          'verified',
          this.readinessCount(),
          'Required SBC master-side building blocks currently ready.',
        ),
      ];
    }
    return [
      this.metric(
        'accounts',
        'Tenant SBC accounts',
        'settings_input_component',
        snapshot.accounts,
        'Tenant SBC assignments linked to authorized runtime servers.',
      ),
      this.metric(
        'peers',
        'SIP peers',
        'settings_ethernet',
        snapshot.peers,
        'Inbound and outbound SIP interconnections configured for the tenant.',
      ),
      this.metric(
        'pipes',
        'Traffic pipes',
        'schema',
        snapshot.pipes,
        'Routing pipes that bind matched traffic to output destinations.',
      ),
      this.metric(
        'manipulations',
        'Manipulation rules',
        'transform',
        snapshot.manipulations,
        'Number and SIP header manipulation rules available to routing pipes.',
      ),
    ];
  });
  readonly readiness = computed<SbcReadinessItem[]>(() => this.readinessRows());
  readonly inventory = computed<SbcInventoryRow[]>(() => {
    const snapshot = this.snapshot();
    const rows = this.masterScope()
      ? [
          this.inventoryRow('servers', 'Runtime nodes', snapshot.servers),
          this.inventoryRow('interfaces', 'SIP interfaces', snapshot.interfaces),
        ]
      : [
          this.inventoryRow('accounts', 'Tenant SBC accounts', snapshot.accounts),
          this.inventoryRow('servers', 'Runtime nodes', snapshot.servers),
          this.inventoryRow('peers', 'SIP peers', snapshot.peers),
          this.inventoryRow('pipes', 'Traffic pipes', snapshot.pipes),
          this.inventoryRow('manipulations', 'Manipulation rules', snapshot.manipulations),
        ];
    return rows;
  });
  readonly operationalSummary = computed(() => {
    const readiness = this.readiness();
    const ready = readiness.filter((item) => item.ready).length;
    const total = readiness.length;
    const state = total > 0 && ready === total ? 'Ready' : ready > 0 ? 'Partial' : 'Attention';
    return { ready, total, state };
  });

  refresh(): void {
    this.snapshotResource.reload();
  }

  private async loadSnapshot(): Promise<SbcSnapshot> {
    try {
      const response = await this.api.get<{ data?: Partial<Record<string, Partial<SbcCount>>> }>(
        `${this.endpointPrefix}/dashboard`,
        { timeout: 30000 },
      );
      const data = response?.data ?? {};
      const snapshot = { ...EMPTY_SNAPSHOT };
      for (const key of SBC_RESOURCES) {
        snapshot[key] = {
          total: Number(data[key]?.total ?? 0),
          active: Number(data[key]?.active ?? 0),
        };
      }
      return snapshot;
    } catch (error) {
      this.snack.error('Failed to load SBC dashboard.');
      throw error;
    }
  }

  private metric(
    key: string,
    label: string,
    icon: string,
    count: SbcCount,
    description: string,
  ): SbcMetric {
    return {
      key,
      label,
      icon,
      total: count.total,
      active: count.active,
      inactive: Math.max(count.total - count.active, 0),
      description,
    };
  }

  private inventoryRow(key: string, label: string, count: SbcCount): SbcInventoryRow {
    const { total, active } = count;
    return {
      key,
      label,
      total,
      active,
      inactive: Math.max(total - active, 0),
      coverage: total > 0 ? Math.round((active / total) * 100) : 0,
    };
  }

  private readinessRows(): SbcReadinessItem[] {
    const snapshot = this.snapshot();
    if (this.masterScope()) {
      const activeServers = snapshot.servers.active;
      const activeInterfaces = snapshot.interfaces.active;
      return [
        {
          key: 'runtime-node',
          label: 'Runtime node available',
          description: 'At least one authorized SBC runtime server is active.',
          ready: activeServers >= 1,
          current: activeServers,
          required: 1,
        },
        {
          key: 'sip-interface',
          label: 'SIP interface available',
          description: 'At least one SIP listening interface is active.',
          ready: activeInterfaces >= 1,
          current: activeInterfaces,
          required: 1,
        },
      ];
    }

    const activeAccounts = snapshot.accounts.active;
    const activeServers = snapshot.servers.active;
    const activePeers = snapshot.peers.active;
    const activePipes = snapshot.pipes.active;
    return [
      {
        key: 'tenant-account',
        label: 'Tenant SBC assigned',
        description: 'At least one tenant SBC account is active and linked to a runtime server.',
        ready: activeAccounts >= 1,
        current: activeAccounts,
        required: 1,
      },
      {
        key: 'runtime-node',
        label: 'Runtime node reachable',
        description: 'At least one authorized runtime server is visible to this tenant.',
        ready: activeServers >= 1,
        current: activeServers,
        required: 1,
      },
      {
        key: 'sip-peer',
        label: 'SIP peer configured',
        description: 'At least one active SIP peer exists for interconnection.',
        ready: activePeers >= 1,
        current: activePeers,
        required: 1,
      },
      {
        key: 'traffic-pipe',
        label: 'Traffic pipe configured',
        description: 'At least one active pipe can route matched traffic.',
        ready: activePipes >= 1,
        current: activePipes,
        required: 1,
      },
    ];
  }

  private readinessCount(): SbcCount {
    const rows = this.readinessRows();
    return { total: rows.length, active: rows.filter((row) => row.ready).length };
  }
}
