import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { SnackbarService } from '../../../services/snackbar.service';
import { fadeIn } from '../../../shared/animations/fade.animation';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  VoipDashboardMetric,
  VoipDashboardModule,
  VoipDashboardRuntime,
  VoipDashboardService,
  VoipDashboardSummary,
} from './dashboard.service';

@Component({
  selector: 'app-voip-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  animations: [fadeIn],
})
export class VoipDashboardPage {
  private readonly api = inject(VoipDashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(false);
  readonly period = signal('today');
  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly generatedAt = signal<string | null>(null);
  readonly startAt = signal<string | null>(null);
  readonly summary = signal<VoipDashboardSummary>({});
  readonly modules = signal<VoipDashboardModule[]>([]);
  readonly runtimeBreakdown = signal<VoipDashboardRuntime[]>([]);
  readonly callBreakdown = signal<VoipDashboardMetric[]>([]);

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
        label: 'WebRTC online',
        value: this.ratio(item.webrtcOnline, item.webrtcServers),
        icon: 'settings_input_antenna',
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

  constructor() {
    void this.loadDashboard();
  }

  refreshList() {
    void this.loadDashboard();
  }

  applySearchFilters() {
    void this.loadDashboard();
  }

  clearSearchFilters() {
    this.period.set('today');
    void this.loadDashboard();
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

  private async loadDashboard() {
    this.loading.set(true);
    try {
      const response = await this.api.get(this.period(), this.isMaster());
      const data = response.data;
      this.summary.set(data.summary ?? {});
      this.modules.set(data.modules ?? []);
      this.runtimeBreakdown.set(data.runtimeBreakdown ?? []);
      this.callBreakdown.set(data.callBreakdown ?? []);
      this.generatedAt.set(data.generatedAt ?? null);
      this.startAt.set(data.startAt ?? null);
    } catch (error) {
      this.snack.error(this.messageFromError(error, 'Failed to load VoIP dashboard.'));
    } finally {
      this.loading.set(false);
    }
  }

  private messageFromError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
