import { Component, computed, inject, resource } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';

import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

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

type SbcSnapshot = {
  accounts: any[];
  servers: any[];
  interfaces: any[];
  peers: any[];
  pipes: any[];
  manipulations: any[];
};

const EMPTY_SNAPSHOT: SbcSnapshot = {
  accounts: [],
  servers: [],
  interfaces: [],
  peers: [],
  pipes: [],
  manipulations: [],
};

@Component({
  selector: 'app-voip-sbc-dashboard',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RefreshButtonComponent,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class VoipSbcDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);
  private readonly endpointPrefix =
    this.route.snapshot.data['scope'] === 'master' ? 'system/voip/sbc' : 'voip/sbc';

  readonly snapshotResource = resource({
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
          'VbsStatus',
          'Authorized SBC runtime servers available to tenants.',
        ),
        this.metric(
          'interfaces',
          'SIP interfaces',
          'settings_input_component',
          snapshot.interfaces,
          'VsiStatus',
          'Listening interfaces prepared for inbound and outbound SIP traffic.',
        ),
        this.metric(
          'readiness',
          'Operational readiness',
          'verified',
          this.readinessRows(),
          'ready',
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
        'VsaStatus',
        'Tenant SBC assignments linked to authorized runtime servers.',
      ),
      this.metric(
        'peers',
        'SIP peers',
        'settings_ethernet',
        snapshot.peers,
        'VspStatus',
        'Inbound and outbound SIP interconnections configured for the tenant.',
      ),
      this.metric(
        'pipes',
        'Traffic pipes',
        'schema',
        snapshot.pipes,
        'VbpStatus',
        'Routing pipes that bind matched traffic to output destinations.',
      ),
      this.metric(
        'manipulations',
        'Manipulation rules',
        'transform',
        snapshot.manipulations,
        'VsmStatus',
        'Number and SIP header manipulation rules available to routing pipes.',
      ),
    ];
  });
  readonly readiness = computed<SbcReadinessItem[]>(() => this.readinessRows());
  readonly inventory = computed<SbcInventoryRow[]>(() => {
    const snapshot = this.snapshot();
    const rows = this.masterScope()
      ? [
          this.inventoryRow('servers', 'Runtime nodes', snapshot.servers, 'VbsStatus'),
          this.inventoryRow('interfaces', 'SIP interfaces', snapshot.interfaces, 'VsiStatus'),
        ]
      : [
          this.inventoryRow('accounts', 'Tenant SBC accounts', snapshot.accounts, 'VsaStatus'),
          this.inventoryRow('servers', 'Runtime nodes', snapshot.servers, 'VbsStatus'),
          this.inventoryRow('peers', 'SIP peers', snapshot.peers, 'VspStatus'),
          this.inventoryRow('pipes', 'Traffic pipes', snapshot.pipes, 'VbpStatus'),
          this.inventoryRow(
            'manipulations',
            'Manipulation rules',
            snapshot.manipulations,
            'VsmStatus',
          ),
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
      const master = this.masterScope();
      const [accounts, servers, interfaces, peers, pipes, manipulations] = await Promise.all([
        master
          ? Promise.resolve([])
          : this.fetchItems(`${this.endpointPrefix}/accounts?limit=500&offset=0`),
        this.fetchItems(`${this.endpointPrefix}/servers?limit=500&offset=0`),
        master
          ? this.fetchItems(`${this.endpointPrefix}/interfaces?limit=500&offset=0`)
          : Promise.resolve([]),
        master
          ? Promise.resolve([])
          : this.fetchItems(`${this.endpointPrefix}/peers?limit=500&offset=0`),
        master
          ? Promise.resolve([])
          : this.fetchItems(`${this.endpointPrefix}/pipes?limit=500&offset=0`),
        master
          ? Promise.resolve([])
          : this.fetchItems(`${this.endpointPrefix}/manipulations?limit=500&offset=0`),
      ]);
      return { accounts, servers, interfaces, peers, pipes, manipulations };
    } catch (error) {
      this.snack.error('Failed to load SBC dashboard.');
      throw error;
    }
  }

  private async fetchItems(endpoint: string): Promise<any[]> {
    const response = await this.api.get<any>(endpoint);
    return extractItems(response);
  }

  private metric(
    key: string,
    label: string,
    icon: string,
    rows: any[],
    statusField: string,
    description: string,
  ): SbcMetric {
    const active = rows.filter((row) => this.isActive(row?.[statusField])).length;
    return {
      key,
      label,
      icon,
      total: rows.length,
      active,
      inactive: Math.max(rows.length - active, 0),
      description,
    };
  }

  private inventoryRow(
    key: string,
    label: string,
    rows: any[],
    statusField: string,
  ): SbcInventoryRow {
    const active = rows.filter((row) => this.isActive(row?.[statusField])).length;
    const total = rows.length;
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
      const activeServers = this.activeCount(snapshot.servers, 'VbsStatus');
      const activeInterfaces = this.activeCount(snapshot.interfaces, 'VsiStatus');
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

    const activeAccounts = this.activeCount(snapshot.accounts, 'VsaStatus');
    const activeServers = this.activeCount(snapshot.servers, 'VbsStatus');
    const activePeers = this.activeCount(snapshot.peers, 'VspStatus');
    const activePipes = this.activeCount(snapshot.pipes, 'VbpStatus');
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

  private activeCount(rows: any[], statusField: string): number {
    return rows.filter((row) => this.isActive(row?.[statusField])).length;
  }

  private isActive(value: unknown): boolean {
    return value === true || Number(value) === 1 || String(value).toLowerCase() === 'active';
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}
