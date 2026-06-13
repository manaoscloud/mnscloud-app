import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { AppI18nService } from '../../services/app-i18n.service';

type ApiResponse<T> = {
  status: string;
  message: string;
  data: T;
  duration?: string;
};

type DashboardWallet = {
  currency: string;
  balance: number;
  reserved: number;
  available: number;
};

type DashboardBilling = {
  catalogItems: number;
  activeSubscriptions: number;
  pendingTopups: number;
  ledgerEntries: number;
  activeEntitlements: number;
};

type DashboardModule = {
  code: string;
  label: string;
  module: string;
  route: string | null;
  status: string;
};

type DashboardAlert = {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
};

type DashboardActivity = {
  uuid: string | null;
  type: string;
  direction: string;
  amount: number;
  currency: string;
  reason: string;
  createdAt: string | null;
};

type TenantDashboardSnapshot = {
  generatedAt: string;
  account: {
    email: string | null;
    role: string;
    environmentUUID: string | null;
  };
  wallet: DashboardWallet;
  billing: DashboardBilling;
  modules: DashboardModule[];
  alerts: DashboardAlert[];
  activity: DashboardActivity[];
};

const EMPTY_DASHBOARD: TenantDashboardSnapshot = {
  generatedAt: new Date(0).toISOString(),
  account: {
    email: null,
    role: 'TENANT',
    environmentUUID: null,
  },
  wallet: {
    currency: 'BRL',
    balance: 0,
    reserved: 0,
    available: 0,
  },
  billing: {
    catalogItems: 0,
    activeSubscriptions: 0,
    pendingTopups: 0,
    ledgerEntries: 0,
    activeEntitlements: 0,
  },
  modules: [],
  alerts: [],
  activity: [],
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    RouterLink,
    TranslocoPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(AppI18nService);

  readonly dashboardResource = resource({
    defaultValue: EMPTY_DASHBOARD,
    loader: () => this.loadDashboard(),
  });

  readonly loading = this.dashboardResource.isLoading;
  readonly dashboard = computed(() => this.dashboardResource.value());
  readonly user = this.auth.user;
  readonly fullName = computed(() => {
    const user = this.user();
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return name || this.dashboard().account.email || '-';
  });

  readonly kpis = computed(() => {
    const snapshot = this.dashboard();
    return [
      {
        icon: 'account_balance_wallet',
        label: 'Available balance',
        value: this.formatMoney(snapshot.wallet.available, snapshot.wallet.currency),
        detail: 'Ready for eligible services',
        state: snapshot.wallet.available > 0 ? 'good' : 'warn',
      },
      {
        icon: 'subscriptions',
        label: 'Active subscriptions',
        value: String(snapshot.billing.activeSubscriptions),
        detail: 'Current contracted services',
        state: snapshot.billing.activeSubscriptions > 0 ? 'good' : 'neutral',
      },
      {
        icon: 'verified_user',
        label: 'Active entitlements',
        value: String(snapshot.billing.activeEntitlements),
        detail: 'Granted module permissions',
        state: snapshot.billing.activeEntitlements > 0 ? 'good' : 'neutral',
      },
      {
        icon: 'payments',
        label: 'Pending top-ups',
        value: String(snapshot.billing.pendingTopups),
        detail: 'Awaiting payment confirmation',
        state: snapshot.billing.pendingTopups > 0 ? 'warn' : 'good',
      },
    ];
  });

  refresh() {
    this.dashboardResource.reload();
  }

  formatMoney(value: number, currency = 'BRL'): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
  }

  trackModule(_: number, item: DashboardModule) {
    return item.code;
  }

  trackActivity(_: number, item: DashboardActivity) {
    return item.uuid ?? `${item.type}-${item.reason}-${item.createdAt}`;
  }

  private async loadDashboard(): Promise<TenantDashboardSnapshot> {
    const response = await this.api.get<ApiResponse<TenantDashboardSnapshot>>('dashboard/tenant');
    return response.data ?? EMPTY_DASHBOARD;
  }
}
