import { Component, computed, effect, inject, resource } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../../../services/snackbar.service';
import { MnsDateTimePipe } from '../../../../shared/date-time/date-time.pipe';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { SoftswitchDashboardServer, VoipSoftswitchDashboardService } from './dashboard.service';

@Component({
  selector: 'app-voip-softswitch-dashboard',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class VoipSoftswitchDashboardPage {
  private readonly api = inject(VoipSoftswitchDashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly isMaster = computed(() => this.route.snapshot.data?.['scope'] === 'master');
  private readonly dashboardResource = resource({
    params: () => ({ isMaster: this.isMaster() }),
    loader: ({ params }) => this.api.get(params.isMaster),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly servers = computed(() => this.dashboard()?.servers ?? []);
  readonly serverColumns = ['health', 'name', 'engine', 'hostname', 'lastSeenAt'];
  readonly serverTable = createSignalCrudTable<SoftswitchDashboardServer>(
    this.servers,
    (row, column) => this.serverSortValue(row, column),
  );

  readonly kpis = computed(() => {
    const data = this.dashboard();
    return [
      {
        label: 'Servers online',
        value: this.ratio(
          data?.servers.filter((server) => server.health === 'online').length,
          data?.servers.length,
        ),
        icon: 'dns',
        route: this.isMaster() ? '/system/softswitch/server' : null,
      },
      {
        label: 'Accounts active',
        value: this.ratio(data?.activeAccounts, data?.accounts),
        icon: 'router',
        route: this.isMaster() ? '/system/softswitch/accounts' : '/voip/softswitch/accounts',
      },
      {
        label: 'Subscribers active',
        value: this.ratio(data?.activeSubscribers, data?.subscribers),
        icon: 'person',
        route: this.isMaster() ? null : '/voip/softswitch/subscriber',
      },
      {
        label: 'DIDs active',
        value: this.ratio(data?.activeDids, data?.dids),
        icon: 'tag',
        route: this.isMaster() ? null : '/voip/softswitch/did',
      },
      {
        label: 'Trunks active',
        value: this.ratio(data?.activeTrunks, data?.trunks),
        icon: 'settings_input_component',
        route: this.isMaster() ? null : '/voip/softswitch/trunks',
      },
      {
        label: 'Routes active',
        value: this.ratio(data?.activeRoutes, data?.routes),
        icon: 'alt_route',
        route: this.isMaster() ? null : '/voip/softswitch/routes',
      },
    ];
  });

  private readonly reportState = effect(() => {
    const error = this.dashboardResource.error();
    if (error) this.snack.error('Failed to load Softswitch dashboard.');
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  setServerSort(sort: Sort) {
    this.serverTable.setSort(sort);
  }

  setServerPage(page: PageEvent) {
    this.serverTable.setPage(page);
  }

  healthLabel(health: string) {
    if (health === 'online') return 'Online';
    if (health === 'offline') return 'Offline';
    if (health === 'inactive') return 'Inactive';
    return 'Unknown';
  }

  private ratio(value?: number, total?: number) {
    return `${Number(value ?? 0)}/${Number(total ?? 0)}`;
  }

  private serverSortValue(row: SoftswitchDashboardServer, column: string): string | number {
    const value = row[column as keyof SoftswitchDashboardServer];
    if (typeof value === 'number') return value;
    return String(value ?? '');
  }
}
