import { dashboardResource } from '../../../../shared/dashboard/dashboard-resource';
import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { DateTimeFormatService } from '../../../../services/date-time-format.service';
import { DashboardPageComponent } from '../../../../shared/dashboard/dashboard-page';
import {
  BillingService,
  type BillingTenantDashboard,
  type BillingUpcomingPriceAdjustment,
} from '../../shared/billing.service';

const EMPTY_TENANT_DASHBOARD: BillingTenantDashboard = {
  generatedAt: '',
  wallet: {
    currency: 'BRL',
    balance: 0,
    reserved: 0,
    available: 0,
  },
  metrics: {
    catalogItems: 0,
    activeSubscriptions: 0,
    pendingCancelSubscriptions: 0,
    suspendedSubscriptions: 0,
    pendingPaymentSubscriptions: 0,
    totalSubscriptions: 0,
    pendingTopups: 0,
    ledgerEntries: 0,
    activeEntitlements: 0,
  },
  nextRenewal: null,
  contractedModules: [],
  recentLedger: [],
  alerts: [],
};

@Component({
  selector: 'app-billing-tenant-dashboard',
  standalone: true,
  imports: [MatIconModule, NgClass, DashboardPageComponent, RouterLink, TranslocoPipe],
  template: `<mns-dashboard-page
    class=""
    [title]="'Billing'"
    [description]="'Prepaid balance, contracted modules, renewals and ledger summary.'"
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
            @if (item.detail) {
              <small>{{ item.detail | transloco }}</small>
            }
          </div>
        </div>
      }
    </div>

    @if (alerts().length) {
      <div class="alert-list" aria-live="polite">
        @for (alert of alerts(); track alert.code) {
          <div class="dashboard-alert" [ngClass]="'alert-' + alert.severity">
            <mat-icon>{{ alertIcon(alert.severity) }}</mat-icon>
            <span>
              {{ alert.message | transloco }}
              @if (alert.blockAt) {
                ({{ 'Blocks at' | transloco }} {{ formatDate(alert.blockAt) }})
              }
            </span>
          </div>
        }
      </div>
    }

    @if (priceAdjustments().length) {
      <section class="dashboard-panel price-adjustments-panel" aria-live="polite">
        <div class="panel-header">
          <div>
            <h2>{{ 'Scheduled price adjustments' | transloco }}</h2>
            <p>
              {{
                'New prices apply from the first renewal on or after the effective date. You can cancel the subscription before it.'
                  | transloco
              }}
            </p>
          </div>
          <span class="panel-count">{{ priceAdjustments().length }}</span>
        </div>
        <div class="dashboard-record-list">
          @for (adjustment of priceAdjustments(); track adjustment.BsuUUID + adjustment.BpjUUID) {
            <article class="dashboard-record-row">
              <div class="dashboard-record-identity">
                <strong>{{ adjustment.OfferName }}</strong>
                <span>{{ adjustmentTerms(adjustment) | transloco }}</span>
              </div>
              <div>
                <small>{{ 'Current price' | transloco }}</small>
                <strong>{{
                  formatCurrency(adjustment.CurrentUnitPrice, adjustment.Currency)
                }}</strong>
              </div>
              <div>
                <small>{{ 'New price' | transloco }}</small>
                <strong>{{ formatCurrency(adjustment.NewUnitPrice, adjustment.Currency) }}</strong>
              </div>
              <div>
                <small>{{ 'Applies at' | transloco }}</small>
                <strong>{{ formatDate(adjustment.AppliesAt || adjustment.EffectiveAt) }}</strong>
              </div>
              <a class="status-chip status-pending" routerLink="/billing/subscriptions">
                {{ 'Subscriptions' | transloco }}
              </a>
            </article>
          }
        </div>
      </section>
    }

    <div class="dashboard-sections">
      <section class="dashboard-panel contracted-panel">
        <div class="panel-header">
          <div>
            <h2>{{ 'Contracted modules' | transloco }}</h2>
            <p>{{ 'Active contracts and scheduled renewals for this tenant.' | transloco }}</p>
          </div>
          <span class="panel-count">{{ contracts().length }}</span>
        </div>

        @if (contracts().length) {
          <div class="dashboard-record-list">
            @for (contract of contracts(); track contract.subscriptionUUID) {
              <article class="dashboard-record-row">
                <div class="dashboard-record-identity">
                  <strong>{{ contract.productName || contract.productCode || '-' }}</strong>
                  <span>{{ contract.planName || contract.module || '-' }}</span>
                </div>
                <div>
                  <small>{{ 'Contracted at' | transloco }}</small>
                  <strong>{{ formatDate(contract.contractedAt) }}</strong>
                </div>
                <div>
                  <small>{{ 'Renews at' | transloco }}</small>
                  <strong>{{ formatDateTime(contract.nextBillAt) }}</strong>
                </div>
                <div>
                  <small>{{ 'Amount' | transloco }}</small>
                  <strong>{{ formatCurrency(contract.totalAmount, contract.currency) }}</strong>
                </div>
                <span class="status-chip" [ngClass]="statusClass(contract.status)">
                  {{ statusLabel(contract.status) | transloco }}
                </span>
              </article>
            }
          </div>
        } @else {
          <div class="empty-state">
            <mat-icon>inventory_2</mat-icon>
            <strong>{{ 'No contracted modules found.' | transloco }}</strong>
            <span>{{
              'Available products can be contracted from the billing catalog.' | transloco
            }}</span>
          </div>
        }
      </section>

      <section class="dashboard-panel activity-panel">
        <div class="panel-header">
          <div>
            <h2>{{ 'Recent billing activity' | transloco }}</h2>
            <p>{{ 'Latest wallet ledger entries.' | transloco }}</p>
          </div>
          <span class="panel-count">{{ recentLedger().length }}</span>
        </div>

        @if (recentLedger().length) {
          <div class="activity-list">
            @for (entry of recentLedger(); track entry.ledgerUUID) {
              <article class="activity-item">
                <mat-icon [ngClass]="entry.direction === 'CREDIT' ? 'credit' : 'debit'">
                  {{ entry.direction === 'CREDIT' ? 'add_circle' : 'remove_circle' }}
                </mat-icon>
                <div>
                  <strong>{{ ledgerTypeLabel(entry.type) | transloco }}</strong>
                  <span>{{ formatDateTime(entry.createdAt) }}</span>
                </div>
                <strong>{{ formatCurrency(entry.amount, entry.currency) }}</strong>
              </article>
            }
          </div>
        } @else {
          <div class="empty-state compact">
            <mat-icon>receipt_long</mat-icon>
            <strong>{{ 'No billing activity yet.' | transloco }}</strong>
          </div>
        }
      </section>
    </div>
  </mns-dashboard-page>`,
})
export class BillingTenantDashboardPage {
  private readonly billing = inject(BillingService);
  private readonly dateTime = inject(DateTimeFormatService);

  readonly priceAdjustments = signal<BillingUpcomingPriceAdjustment[]>([]);

  readonly dashboard = dashboardResource({
    defaultValue: EMPTY_TENANT_DASHBOARD,
    loader: async () => {
      // Upcoming adjustments are informative; their failure never hides the dashboard.
      const [dashboard, adjustments] = await Promise.all([
        this.billing.getTenantDashboard(),
        this.billing
          .listUpcomingPriceAdjustments()
          .catch((): BillingUpcomingPriceAdjustment[] => []),
      ]);
      this.priceAdjustments.set(adjustments);
      return dashboard ?? EMPTY_TENANT_DASHBOARD;
    },
  });

  readonly loading = computed(() => this.dashboard.isLoading());
  readonly contracts = computed(() => this.dashboard.value().contractedModules);
  readonly recentLedger = computed(() => this.dashboard.value().recentLedger);
  readonly alerts = computed(() => this.dashboard.value().alerts);
  readonly summary = computed(() => {
    const value = this.dashboard.value();
    const renewal = value.nextRenewal;
    return [
      {
        label: 'Available balance',
        value: this.formatCurrency(value.wallet.available, value.wallet.currency),
        detail:
          value.wallet.reserved > 0
            ? `${this.formatCurrency(value.wallet.reserved, value.wallet.currency)} ${this.label('reserved')}`
            : '',
        icon: 'account_balance_wallet',
      },
      {
        label: 'Active subscriptions',
        value: value.metrics.activeSubscriptions,
        detail:
          value.metrics.pendingCancelSubscriptions > 0
            ? `${value.metrics.pendingCancelSubscriptions} ${this.label('pending cancellation')}`
            : '',
        icon: 'subscriptions',
      },
      {
        label: 'Contracted modules',
        value: value.contractedModules.length,
        detail: `${value.metrics.activeEntitlements} ${this.label('active entitlements')}`,
        icon: 'deployed_code',
      },
      {
        label: 'Next renewal',
        value: renewal ? this.formatCurrency(renewal.amount, renewal.currency) : this.label('None'),
        detail: renewal?.nextBillAt ? this.formatDateTime(renewal.nextBillAt) : '',
        icon: 'event_repeat',
      },
    ];
  });

  formatCurrency(value: number | null | undefined, currency = 'BRL'): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(Number(value ?? 0));
  }

  formatDate(value: string | null | undefined): string {
    return this.dateTime.formatDate(value, 'short') || '-';
  }

  formatDateTime(value: string | null | undefined): string {
    return this.dateTime.formatDateTime(value, 'short', 'short') || '-';
  }

  statusLabel(status: string | null | undefined): string {
    const normalized = (status || '').toUpperCase();
    return (
      (
        {
          ACTIVE: 'Active',
          PENDING_CANCEL: 'Pending cancellation',
          PENDING_PAYMENT: 'Pending payment',
          SUSPENDED: 'Suspended',
          CANCELED: 'Canceled',
        } as Record<string, string>
      )[normalized] ||
      normalized ||
      '-'
    );
  }

  statusClass(status: string | null | undefined): string {
    return (status || '').toUpperCase() === 'ACTIVE' ? 'status-active' : 'status-pending';
  }

  ledgerTypeLabel(type: string | null | undefined): string {
    const normalized = (type || '').toUpperCase();
    return (
      (
        {
          DEBIT_SUBSCRIPTION: 'Subscription debit',
          ONE_TIME_SETUP_DEBIT: 'One-time setup debit',
          WALLET_TOPUP: 'Wallet top-up',
          MANUAL_CREDIT: 'Manual credit',
        } as Record<string, string>
      )[normalized] ||
      normalized ||
      '-'
    );
  }

  adjustmentTerms(adjustment: BillingUpcomingPriceAdjustment): string {
    if (adjustment.AdjustmentType === 'NEW_PRICE' || adjustment.Percent === null) {
      return adjustment.Reason || 'Price adjustment';
    }
    const percent = `${adjustment.Percent > 0 ? '+' : ''}${Number(adjustment.Percent).toFixed(2)}%`;
    return adjustment.AdjustmentType === 'INDEX' && adjustment.IndexCode
      ? `${adjustment.IndexCode} ${percent}`
      : percent;
  }

  alertIcon(severity: string): string {
    return severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  }

  private label(value: string): string {
    return value;
  }
}
