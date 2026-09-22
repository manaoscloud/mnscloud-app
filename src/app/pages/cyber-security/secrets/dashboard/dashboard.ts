import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../../services/api.service';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import {
  DashboardRecordListComponent,
  type DashboardRecord,
} from '../../../../shared/dashboard/dashboard-record-list';
import {
  readSecretInventory,
  readTotal,
  secretRecords,
  stateCounts,
  type SecretMetadata,
} from './dashboard-model';

@Component({
  selector: 'app-secrets-dashboard',
  imports: [
    DashboardPageComponent,
    DashboardRecordListComponent,
    RouterLink,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
})
export class SecretsDashboardPage {
  private readonly api = inject(ApiService);
  readonly isMaster = inject(ActivatedRoute).snapshot.data['scope'] === 'master';
  readonly base = this.isMaster ? 'system/cyber-security' : 'cyber-security';
  readonly snapshot = dashboardResource({
    defaultValue: {
      items: [] as SecretMetadata[],
      total: null as number | null,
      active: null as number | null,
      inactive: null as number | null,
      accounts: null as number | null,
    },
    loader: async () => {
      // All requests are bounded metadata reads. Never call a reveal/value or health-test endpoint.
      const [inventory, active, inactive, accounts] = await Promise.allSettled([
        this.api.get(`${this.base}/secrets?limit=100&offset=0`, { timeout: 30000 }),
        this.api.get(`${this.base}/secrets?status=1&limit=1&offset=0`, { timeout: 30000 }),
        this.api.get(`${this.base}/secrets?status=0&limit=1&offset=0`, { timeout: 30000 }),
        this.api.get(`${this.base}/secret-accounts?limit=1&offset=0`, { timeout: 30000 }),
      ]);
      if (inventory.status === 'rejected') throw inventory.reason;
      const data = readSecretInventory(inventory.value);
      const optionalTotal = (result: PromiseSettledResult<unknown>) => {
        if (result.status === 'rejected') return null;
        try {
          return readTotal(result.value);
        } catch {
          return null;
        }
      };
      return {
        ...data,
        active: optionalTotal(active),
        inactive: optionalTotal(inactive),
        accounts: optionalTotal(accounts),
      };
    },
  });
  readonly kpis = computed(() => [
    { label: 'secretsDashboard.total', value: this.snapshot.value().total, icon: 'key' },
    { label: 'secretsDashboard.active', value: this.snapshot.value().active, icon: 'check_circle' },
    {
      label: 'secretsDashboard.inactive',
      value: this.snapshot.value().inactive,
      icon: 'pause_circle',
    },
    { label: 'Secret Accounts', value: this.snapshot.value().accounts, icon: 'manage_accounts' },
  ]);
  readonly validity = computed(() => stateCounts(this.snapshot.value().items, 'ValidityState'));
  readonly operations = computed(() => stateCounts(this.snapshot.value().items, 'ValueState'));
  readonly attention = computed<DashboardRecord[]>(() =>
    secretRecords(this.snapshot.value().items),
  );
}
