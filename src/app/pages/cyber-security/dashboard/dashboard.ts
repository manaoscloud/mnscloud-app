import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';

type CyberSummary = Partial<{
  servers: number;
  protectedServers: number;
  attentionServers: number;
  openAlerts: number;
  activeDecisions: number;
  trustedNodes: number;
  securityEvents24h: number;
}>;

@Component({
  selector: 'app-cyber-security-dashboard',
  standalone: true,
  imports: [DashboardPageComponent, MatIconModule, RouterLink, TranslocoPipe],
  templateUrl: './dashboard.html',
})
export class CyberSecurityDashboardPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly snapshot = dashboardResource({
    defaultValue: {} as CyberSummary,
    loader: async () => {
      const result = await this.api.get<{ data: CyberSummary }>('cyber-security/dashboard', {
        timeout: 30000,
      });
      if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data))
        throw new Error('Invalid dashboard response');
      return result.data;
    },
  });
  readonly dashboard = this.snapshot.value;
  readonly actions = [
    { section: 'servers', icon: 'dns', label: 'Review server protection' },
    { section: 'profiles', icon: 'shield', label: 'Maintain security profiles' },
    { section: 'alerts', icon: 'notification_important', label: 'Investigate open alerts' },
    { section: 'trusted-nodes', icon: 'hub', label: 'Review trusted nodes' },
  ];
  routeFor(section: string) {
    return (
      (this.router.url.startsWith('/system/cyber-security')
        ? '/system/cyber-security'
        : '/cyber-security') +
      '/' +
      section
    );
  }
  readonly dashboardKpis = computed(() => {
    const item = this.dashboard();
    return [
      {
        label: 'Protected coverage',
        value: this.ratio(item.protectedServers, item.servers),
        icon: 'admin_panel_settings',
      },
      {
        label: 'Needs attention',
        value: this.number(item.attentionServers),
        icon: 'report_problem',
      },
      {
        label: 'Open alerts',
        value: this.number(item.openAlerts),
        icon: 'notification_important',
      },
      {
        label: 'Active decisions',
        value: this.number(item.activeDecisions),
        icon: 'gavel',
      },
      {
        label: 'Trusted nodes',
        value: this.number(item.trustedNodes),
        icon: 'hub',
      },
      {
        label: 'Events 24h',
        value: this.number(item.securityEvents24h),
        icon: 'manage_search',
      },
    ];
  });
  readonly postureMetrics = computed(() => {
    const item = this.dashboard();
    const total = Number(item.servers ?? 0);
    return [
      {
        label: 'Servers enrolled',
        value: this.number(item.servers),
        percent: total > 0 ? 100 : 0,
      },
      {
        label: 'Protected servers',
        value: this.number(item.protectedServers),
        percent: this.percent(item.protectedServers, item.servers),
      },
      {
        label: 'Needs attention',
        value: this.number(item.attentionServers),
        percent: this.percent(item.attentionServers, item.servers),
      },
      {
        label: 'Open alerts',
        value: this.number(item.openAlerts),
        percent: this.percent(item.openAlerts, item.servers || item.openAlerts),
      },
    ];
  });
  private number(value: unknown) {
    return String(Number(value ?? 0));
  }

  private ratio(value: unknown, total: unknown) {
    return `${Number(value ?? 0)}/${Number(total ?? 0)}`;
  }

  private percent(value: unknown, total: unknown) {
    const denominator = Number(total ?? 0);
    if (!denominator) return 0;
    return Math.min(100, Math.round((Number(value ?? 0) / denominator) * 100));
  }
}
