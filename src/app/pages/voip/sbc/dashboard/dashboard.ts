import { Component, computed, inject, resource } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';

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
  route: string | null;
};

type SbcAction = {
  key: string;
  label: string;
  description: string;
  icon: string;
  route: string | null;
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
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RefreshButtonComponent,
    RouterLink,
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
  readonly baseRoute = computed(() =>
    this.route.snapshot.data['scope'] === 'master' ? '/system/sbc' : '/voip/sbc',
  );
  readonly metrics = computed<SbcMetric[]>(() => {
    const snapshot = this.snapshot();
    const master = this.route.snapshot.data['scope'] === 'master';
    if (master) {
      return [
        this.metric('servers', 'Servers', 'dns', snapshot.servers, 'VbsStatus', 'server'),
        this.metric(
          'interfaces',
          'Interfaces',
          'settings_input_component',
          snapshot.interfaces,
          'VsiStatus',
          'interface',
        ),
      ];
    }
    return [
      this.metric(
        'accounts',
        'SBC',
        'settings_input_component',
        snapshot.accounts,
        'VsaStatus',
        'account',
      ),
      this.metric(
        'peers',
        'Peers',
        'settings_ethernet',
        snapshot.peers,
        'VspStatus',
        'peer',
      ),
      this.metric('pipes', 'Pipes', 'schema', snapshot.pipes, 'VbpStatus', 'pipe'),
      this.metric(
        'manipulations',
        'Manipulations',
        'transform',
        snapshot.manipulations,
        'VsmStatus',
        'manipulation',
      ),
    ];
  });
  readonly actions = computed<SbcAction[]>(() => {
    const master = this.route.snapshot.data['scope'] === 'master';
    return master
      ? [
          {
            key: 'interface',
            label: 'Interfaces',
            description: 'Configure SIP listening interfaces.',
            icon: 'settings_input_component',
            route: `${this.baseRoute()}/interface`,
          },
          {
            key: 'server',
            label: 'Servers',
            description: 'Register authorized SBC runtime nodes.',
            icon: 'dns',
            route: `${this.baseRoute()}/server`,
          },
        ]
      : [
          {
            key: 'account',
            label: 'SBC',
            description: 'Select the authorized SBC server for this tenant.',
            icon: 'settings_input_component',
            route: `${this.baseRoute()}/account`,
          },
          {
            key: 'peer',
            label: 'Peers',
            description: 'Configure SIP interconnections and authentication.',
            icon: 'settings_ethernet',
            route: `${this.baseRoute()}/peer`,
          },
          {
            key: 'pipe',
            label: 'Pipes',
            description: 'Bind inbound peers to outbound SIP destinations.',
            icon: 'schema',
            route: `${this.baseRoute()}/pipe`,
          },
        ];
  });

  refresh(): void {
    this.snapshotResource.reload();
  }

  private async loadSnapshot(): Promise<SbcSnapshot> {
    try {
      const master = this.route.snapshot.data['scope'] === 'master';
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
    routeSegment: string,
  ): SbcMetric {
    const master = this.route.snapshot.data['scope'] === 'master';
    const route =
      master && !['server', 'interface'].includes(routeSegment)
        ? null
        : `${this.baseRoute()}/${routeSegment}`;
    return {
      key,
      label,
      icon,
      total: rows.length,
      active: rows.filter((row) => Number(row?.[statusField]) === 1).length,
      route,
    };
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}
