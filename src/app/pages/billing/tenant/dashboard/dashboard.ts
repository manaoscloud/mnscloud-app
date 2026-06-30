import { Component, computed, inject, resource } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { BillingService } from '../../shared/billing.service';

type TenantBillingDashboard = {
  walletBalance: number;
  walletCurrency: string;
  catalog: number;
  subscriptions: number;
  ledger: number;
};

const EMPTY_TENANT_DASHBOARD: TenantBillingDashboard = {
  walletBalance: 0,
  walletCurrency: 'BRL',
  catalog: 0,
  subscriptions: 0,
  ledger: 0,
};

@Component({
  selector: 'app-billing-tenant-dashboard',
  standalone: true,
  imports: [MatCardModule, MatIconModule, RefreshButtonComponent, TranslocoPipe],
  template: `
    <section class="erp-page dashboard-page">
      <mat-card class="erp-card dashboard-shell">
        <div class="erp-header">
          <div>
            <h1>{{ 'Billing' | transloco }}</h1>
            <p>{{ 'Prepaid balance, service catalog, subscriptions and ledger.' | transloco }}</p>
          </div>
          <div class="header-actions">
            <app-refresh-button [loading]="loading()" (refresh)="dashboard.reload()" />
          </div>
        </div>

        <div class="dashboard-grid">
          @for (item of summary(); track item.label) {
            <div class="dashboard-metric">
              <mat-icon>{{ item.icon }}</mat-icon>
              <div>
                <span class="dashboard-metric-label">{{ item.label | transloco }}</span>
                <strong class="dashboard-metric-value">{{ item.value }}</strong>
              </div>
            </div>
          }
        </div>
      </mat-card>
    </section>
  `,
})
export class BillingTenantDashboardPage {
  private readonly billing = inject(BillingService);

  readonly dashboard = resource({
    defaultValue: EMPTY_TENANT_DASHBOARD,
    loader: async () => {
      const [wallets, catalog, subscriptions, ledger] = await Promise.all([
        this.billing.listWallets(),
        this.billing.listCatalog(''),
        this.billing.listSubscriptions('', ''),
        this.billing.listLedger('', ''),
      ]);
      const wallet = wallets[0];
      return {
        walletBalance: Number(wallet?.BwaBalance ?? 0),
        walletCurrency: wallet?.BwaCurrency ?? 'BRL',
        catalog: catalog.length,
        subscriptions: subscriptions.length,
        ledger: ledger.length,
      };
    },
  });

  readonly loading = computed(() => this.dashboard.isLoading());
  readonly summary = computed(() => {
    const value = this.dashboard.value();
    return [
      {
        label: 'Wallet balance',
        value: `${value.walletCurrency} ${value.walletBalance.toFixed(2)}`,
        icon: 'account_balance_wallet',
      },
      { label: 'Products', value: value.catalog, icon: 'storefront' },
      { label: 'Subscriptions', value: value.subscriptions, icon: 'subscriptions' },
      { label: 'Ledger', value: value.ledger, icon: 'receipt_long' },
    ];
  });
}
