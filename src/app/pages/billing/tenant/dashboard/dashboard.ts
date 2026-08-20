import { NgClass } from '@angular/common';
import { Component, computed, inject, resource } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { DateTimeFormatService } from '../../../../services/date-time-format.service';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { BillingService, type BillingTenantDashboard } from '../../shared/billing.service';

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
  imports: [MatCardModule, MatIconModule, NgClass, RefreshButtonComponent, TranslocoPipe],
  template: `
    <section class="erp-page dashboard-page">
      <mat-card class="erp-card dashboard-shell">
        <div class="erp-header">
          <div>
            <h1>{{ 'Billing' | transloco }}</h1>
            <p>{{ 'Prepaid balance, contracted modules, renewals and ledger summary.' | transloco }}</p>
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
                @if (item.detail) {
                  <small>{{ item.detail | transloco }}</small>
                }
              </div>
            </div>
          }
        </div>

        @if (alerts().length) {
          <div class="billing-alerts" aria-live="polite">
            @for (alert of alerts(); track alert.code) {
              <div class="billing-alert" [ngClass]="'alert-' + alert.severity">
                <mat-icon>{{ alertIcon(alert.severity) }}</mat-icon>
                <span>{{ alert.message | transloco }}</span>
              </div>
            }
          </div>
        }

        <div class="billing-panels">
          <section class="billing-panel contracted-panel">
            <div class="panel-heading">
              <div>
                <h2>{{ 'Contracted modules' | transloco }}</h2>
                <p>{{ 'Active contracts and scheduled renewals for this tenant.' | transloco }}</p>
              </div>
              <span class="panel-count">{{ contracts().length }}</span>
            </div>

            @if (contracts().length) {
              <div class="contract-list">
                @for (contract of contracts(); track contract.subscriptionUUID) {
                  <article class="contract-row">
                    <div class="contract-identity">
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
                <span>{{ 'Available products can be contracted from the billing catalog.' | transloco }}</span>
              </div>
            }
          </section>

          <section class="billing-panel activity-panel">
            <div class="panel-heading">
              <div>
                <h2>{{ 'Recent billing activity' | transloco }}</h2>
                <p>{{ 'Latest wallet ledger entries.' | transloco }}</p>
              </div>
              <span class="panel-count">{{ recentLedger().length }}</span>
            </div>

            @if (recentLedger().length) {
              <div class="ledger-list">
                @for (entry of recentLedger(); track entry.ledgerUUID) {
                  <article class="ledger-row">
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
      </mat-card>
    </section>
  `,
  styles: [
    `
      .dashboard-shell {
        display: grid;
        gap: 24px;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .dashboard-metric {
        display: flex;
        align-items: center;
        gap: 18px;
        min-height: 118px;
        padding: 22px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.12);
      }

      .dashboard-metric mat-icon {
        color: var(--mc-primary, #00d6d6);
      }

      .dashboard-metric-label,
      .dashboard-metric small,
      .panel-heading p,
      .contract-row small,
      .contract-identity span,
      .ledger-row span,
      .empty-state span {
        color: rgba(255, 255, 255, 0.68);
      }

      .dashboard-metric-value {
        display: block;
        margin-top: 4px;
        font-size: clamp(1.55rem, 2vw, 2.15rem);
        line-height: 1.1;
      }

      .billing-alerts {
        display: grid;
        gap: 10px;
      }

      .billing-alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
      }

      .alert-warning mat-icon {
        color: #ffca28;
      }

      .alert-error mat-icon {
        color: #ef5350;
      }

      .billing-panels {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
        gap: 18px;
      }

      .billing-panel {
        display: grid;
        align-content: start;
        gap: 16px;
        min-width: 0;
        padding: 18px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.1);
      }

      .panel-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .panel-heading h2 {
        margin: 0;
        font-size: 1.15rem;
      }

      .panel-heading p {
        margin: 4px 0 0;
      }

      .panel-count,
      .status-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 28px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(0, 214, 214, 0.5);
        color: var(--mc-primary, #00d6d6);
        background: rgba(0, 214, 214, 0.12);
        font-weight: 700;
      }

      .contract-list,
      .ledger-list {
        display: grid;
        gap: 10px;
      }

      .contract-row {
        display: grid;
        grid-template-columns: minmax(180px, 1.4fr) repeat(3, minmax(120px, 1fr)) auto;
        align-items: center;
        gap: 16px;
        padding: 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.16);
      }

      .contract-row small,
      .contract-identity span,
      .ledger-row span {
        display: block;
        margin-top: 2px;
        font-size: 0.82rem;
      }

      .status-active {
        border-color: rgba(0, 214, 214, 0.55);
        color: var(--mc-primary, #00d6d6);
      }

      .status-pending {
        border-color: rgba(255, 202, 40, 0.55);
        color: #ffca28;
        background: rgba(255, 202, 40, 0.12);
      }

      .ledger-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
      }

      .ledger-row mat-icon.credit {
        color: #7ee787;
      }

      .ledger-row mat-icon.debit {
        color: #ffca28;
      }

      .empty-state {
        display: grid;
        place-items: center;
        gap: 8px;
        min-height: 180px;
        padding: 20px;
        text-align: center;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
      }

      .empty-state.compact {
        min-height: 120px;
      }

      @media (max-width: 1200px) {
        .dashboard-grid,
        .billing-panels {
          grid-template-columns: 1fr 1fr;
        }

        .contract-row {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 760px) {
        .dashboard-grid,
        .billing-panels,
        .contract-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BillingTenantDashboardPage {
  private readonly billing = inject(BillingService);
  private readonly dateTime = inject(DateTimeFormatService);

  readonly dashboard = resource({
    defaultValue: EMPTY_TENANT_DASHBOARD,
    loader: async () => (await this.billing.getTenantDashboard()) ?? EMPTY_TENANT_DASHBOARD,
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
        detail: value.wallet.reserved > 0
          ? `${this.formatCurrency(value.wallet.reserved, value.wallet.currency)} ${this.label('reserved')}`
          : '',
        icon: 'account_balance_wallet',
      },
      {
        label: 'Active subscriptions',
        value: value.metrics.activeSubscriptions,
        detail: value.metrics.pendingCancelSubscriptions > 0
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
      {
        ACTIVE: 'Active',
        PENDING_CANCEL: 'Pending cancellation',
        PENDING_PAYMENT: 'Pending payment',
        SUSPENDED: 'Suspended',
        CANCELED: 'Canceled',
      } as Record<string, string>
    )[normalized] || normalized || '-';
  }

  statusClass(status: string | null | undefined): string {
    return (status || '').toUpperCase() === 'ACTIVE' ? 'status-active' : 'status-pending';
  }

  ledgerTypeLabel(type: string | null | undefined): string {
    const normalized = (type || '').toUpperCase();
    return (
      {
        DEBIT_SUBSCRIPTION: 'Subscription debit',
        ONE_TIME_SETUP_DEBIT: 'One-time setup debit',
        WALLET_TOPUP: 'Wallet top-up',
        MANUAL_CREDIT: 'Manual credit',
      } as Record<string, string>
    )[normalized] || normalized || '-';
  }

  alertIcon(severity: string): string {
    return severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  }

  private label(value: string): string {
    return value;
  }
}
