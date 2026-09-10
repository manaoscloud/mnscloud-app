import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { Component, computed, inject } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import { BillingService } from '../../shared/billing.service';

type BillingDashboardSnapshot = {
  products: number;
  prices: number;
  packages: number;
  promotions: number;
  subscriptions: number;
};

const EMPTY_DASHBOARD: BillingDashboardSnapshot = {
  products: 0,
  prices: 0,
  packages: 0,
  promotions: 0,
  subscriptions: 0,
};

@Component({
  selector: 'app-billing-system-dashboard',
  standalone: true,
  imports: [MatIconModule, DashboardPageComponent, TranslocoPipe],
  template: `<mns-dashboard-page
    class=""
    [title]="'Billing dashboard'"
    [description]="'Monitor products, prices, packages, promotions and subscriptions.'"
    [loading]="dashboard.isLoading()"
    [error]="dashboard.error()"
    [hasData]="dashboard.hasData()"
    (refresh)="dashboard.reload()"
  >
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
  </mns-dashboard-page>`,
})
export class BillingSystemDashboardPage {
  private readonly billing = inject(BillingService);

  readonly dashboard = dashboardResource({
    defaultValue: EMPTY_DASHBOARD,
    loader: async () => {
      const [products, prices, packages, promotions, subscriptions] = await Promise.all([
        this.billing.listProducts('', null),
        this.billing.listPrices('', '', null),
        this.billing.listPackages('', null),
        this.billing.listPromotions('', null),
        this.billing.listSystemSubscriptions('', ''),
      ]);
      return {
        products: products.length,
        prices: prices.length,
        packages: packages.length,
        promotions: promotions.length,
        subscriptions: subscriptions.length,
      };
    },
  });

  readonly loading = computed(() => this.dashboard.isLoading());
  readonly summary = computed(() => {
    const value = this.dashboard.value();
    return [
      { label: 'Products', value: value.products, icon: 'storefront' },
      { label: 'Prices', value: value.prices, icon: 'sell' },
      { label: 'Packages', value: value.packages, icon: 'redeem' },
      { label: 'Promotions', value: value.promotions, icon: 'local_offer' },
      { label: 'Subscriptions', value: value.subscriptions, icon: 'subscriptions' },
    ];
  });
}
