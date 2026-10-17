import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../../../services/snackbar.service';
import {
  GlobalTableComponent,
  defineGlobalTable,
} from '../../../../shared/crud/configurable-crud/global-table';
import {
  lastSeenColumn,
  serverHealthColumn,
} from '../../../../shared/dashboard/dashboard-table-columns';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import { VoipSoftswitchDashboardService } from './dashboard.service';

@Component({
  selector: 'app-voip-softswitch-dashboard',
  standalone: true,
  imports: [
    DashboardPageComponent,
    RouterModule,
    MatIconModule,
    TranslocoPipe,
    GlobalTableComponent,
  ],
  templateUrl: './dashboard.html',
})
export class VoipSoftswitchDashboardPage {
  private readonly api = inject(VoipSoftswitchDashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly isMaster = computed(() => this.route.snapshot.data?.['scope'] === 'master');
  readonly dashboardResource = dashboardResource({
    params: () => ({ isMaster: this.isMaster() }),
    loader: ({ params }) => this.api.get(params.isMaster),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly servers = computed(() => this.dashboard()?.servers ?? []);
  readonly serverTable = defineGlobalTable({
    key: 'voip/softswitch/dashboard/servers',
    uuidField: 'uuid',
    emptyLabel: 'No servers found.',
    columns: [
      serverHealthColumn(),
      { id: 'name', label: 'Name', field: 'name' },
      { id: 'engine', label: 'Engine', field: 'engine' },
      { id: 'hostname', label: 'Host', field: 'hostname' },
      lastSeenColumn(),
    ],
  });

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
        route: this.isMaster() ? null : '/voip/softswitch/accounts',
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

  private ratio(value?: number, total?: number) {
    return `${Number(value ?? 0)}/${Number(total ?? 0)}`;
  }
}
