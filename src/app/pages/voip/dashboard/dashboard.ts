
import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../shared/date-time/date-time.pipe';
import {
  VoipDashboardMetric,
  VoipDashboardModule,
  VoipDashboardRuntime,
  VoipDashboardService,
  VoipDashboardSummary,
} from './dashboard.service';

type VoipDashboardSnapshot = {
  summary: VoipDashboardSummary;
  modules: VoipDashboardModule[];
  runtimeBreakdown: VoipDashboardRuntime[];
  callBreakdown: VoipDashboardMetric[];
  generatedAt: string | null;
  startAt: string | null;
};

const EMPTY_VOIP_DASHBOARD: VoipDashboardSnapshot = {
  summary: {},
  modules: [],
  runtimeBreakdown: [],
  callBreakdown: [],
  generatedAt: null,
  startAt: null,
};

@Component({
  selector: 'app-voip-dashboard',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class VoipDashboardPage {
  private readonly api = inject(VoipDashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly period = signal('today');
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  private readonly dashboardResource = resource({
    params: () => ({ period: this.period(), isMaster: this.isMaster() }),
    defaultValue: EMPTY_VOIP_DASHBOARD,
    loader: ({ params }) => this.loadDashboardSnapshot(params.period, params.isMaster),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly generatedAt = computed(() => this.dashboard().generatedAt);
  readonly startAt = computed(() => this.dashboard().startAt);
  readonly summary = computed(() => this.dashboard().summary);
  readonly modules = computed(() => this.dashboard().modules);
  readonly runtimeBreakdown = computed(() => this.dashboard().runtimeBreakdown);
  readonly callBreakdown = computed(() => this.dashboard().callBreakdown);

  readonly periodOptions = [
    { value: 'today', label: 'Today' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7d' },
    { value: '30d', label: 'Last 30d' },
  ];

  readonly kpis = computed(() => {
    const item = this.summary();
    return [
      {
        label: 'Active domains',
        value: this.ratio(item.domainsActive, item.domainsTotal),
        icon: 'language',
      },
      {
        label: 'Assigned DIDs',
        value: this.ratio(item.didAssigned, item.didTotal),
        icon: 'dialpad',
      },
      {
        label: 'Active PABX',
        value: this.ratio(item.pabxActive, item.pabxAccounts),
        icon: 'phone_in_talk',
      },
      {
        label: 'Answered calls',
        value: this.number(item.callsAnswered),
        icon: 'call',
      },
      {
        label: 'Failed calls',
        value: this.number(item.callsFailed),
        icon: 'call_missed',
      },
    ];
  });

  refreshList() {
    this.dashboardResource.reload();
  }

  applySearchFilters() {
    this.dashboardResource.reload();
  }

  clearSearchFilters() {
    this.period.set('today');
    this.dashboardResource.reload();
  }

  metricPercent(item: VoipDashboardMetric, items: VoipDashboardMetric[]) {
    const total = items.reduce((sum, metric) => sum + Number(metric.value ?? 0), 0);
    return total > 0 ? Math.round((Number(item.value ?? 0) / total) * 100) : 0;
  }

  runtimeHealth(item: VoipDashboardRuntime) {
    const total = Number(item.total ?? 0);
    const online = Number(item.online ?? 0);
    if (total <= 0) return 'empty';
    return online >= total ? 'ok' : online > 0 ? 'warning' : 'critical';
  }

  healthLabel(value: string) {
    const labels: Record<string, string> = {
      ok: 'Ready',
      warning: 'Needs attention',
      empty: 'Not configured',
      critical: 'Offline',
    };
    return labels[value] ?? value;
  }

  number(value: unknown) {
    return String(Number(value ?? 0));
  }

  ratio(current: unknown, total: unknown) {
    return `${Number(current ?? 0)}/${Number(total ?? 0)}`;
  }

  private async loadDashboardSnapshot(
    period: string,
    isMaster: boolean,
  ): Promise<VoipDashboardSnapshot> {
    try {
      const response = await this.api.get(period, isMaster);
      const data = response.data;
      return {
        summary: data.summary ?? {},
        modules: data.modules ?? [],
        runtimeBreakdown: data.runtimeBreakdown ?? [],
        callBreakdown: data.callBreakdown ?? [],
        generatedAt: data.generatedAt ?? null,
        startAt: data.startAt ?? null,
      };
    } catch (error) {
      this.snack.error(this.messageFromError(error, 'Failed to load VoIP dashboard.'));
      throw error;
    }
  }

  private messageFromError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
