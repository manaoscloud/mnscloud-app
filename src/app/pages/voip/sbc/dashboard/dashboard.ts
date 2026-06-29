import { Component, computed, inject, resource } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
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
};

type SbcSnapshot = {
  providers: any[];
  servers: any[];
  trunks: any[];
  routes: any[];
  policies: any[];
};

const EMPTY_SNAPSHOT: SbcSnapshot = {
  providers: [],
  servers: [],
  trunks: [],
  routes: [],
  policies: [],
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
  readonly metrics = computed<SbcMetric[]>(() => {
    const snapshot = this.snapshot();
    return [
      this.metric('providers', 'Providers', 'hub', snapshot.providers, 'VbpStatus'),
      this.metric('servers', 'Servers', 'dns', snapshot.servers, 'VbsStatus'),
      this.metric('trunks', 'Trunks', 'settings_ethernet', snapshot.trunks, 'VstStatus'),
      this.metric('routes', 'Routes', 'alt_route', snapshot.routes, 'VbrStatus'),
      this.metric('policies', 'Policies', 'policy', snapshot.policies, 'VpoStatus'),
    ];
  });

  refresh(): void {
    this.snapshotResource.reload();
  }

  private async loadSnapshot(): Promise<SbcSnapshot> {
    try {
      const [providers, servers, trunks, routes, policies] = await Promise.all([
        this.fetchItems(`${this.endpointPrefix}/providers?limit=500&offset=0`),
        this.fetchItems(`${this.endpointPrefix}/servers?limit=500&offset=0`),
        this.fetchItems(`${this.endpointPrefix}/trunks?limit=500&offset=0`),
        this.fetchItems(`${this.endpointPrefix}/routes?limit=500&offset=0`),
        this.fetchItems(`${this.endpointPrefix}/policies?limit=500&offset=0`),
      ]);
      return { providers, servers, trunks, routes, policies };
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
  ): SbcMetric {
    return {
      key,
      label,
      icon,
      total: rows.length,
      active: rows.filter((row) => Number(row?.[statusField]) === 1).length,
    };
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}
