import { Component, computed, inject, resource } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
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
  imports: [MatCardModule, MatIconModule, RefreshButtonComponent, TranslocoPipe],
  template: `
    <section class="erp-page">
      <mat-card class="erp-card">
        <div class="erp-header">
          <div>
            <h1>{{ 'Billing dashboard' | transloco }}</h1>
            <p>
              {{ 'Monitor products, prices, packages, promotions and subscriptions.' | transloco }}
            </p>
          </div>
          <div class="header-actions">
            <app-refresh-button [loading]="loading()" (refresh)="dashboard.reload()" />
          </div>
        </div>

        <div class="summary-grid">
          @for (item of summary(); track item.label) {
            <div class="summary-card">
              <mat-icon>{{ item.icon }}</mat-icon>
              <div>
                <span>{{ item.label | transloco }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          }
        </div>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .summary-card {
        display: flex;
        gap: 14px;
        align-items: center;
        min-height: 92px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 18px;
      }

      .summary-card mat-icon {
        color: var(--tenant-primary-color);
      }

      .summary-card span,
      .summary-card strong {
        display: block;
      }

      .summary-card strong {
        margin-top: 4px;
        font-size: 28px;
      }

      @media (max-width: 900px) {
        .summary-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BillingSystemDashboardPage {
  private readonly billing = inject(BillingService);

  readonly dashboard = resource({
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
