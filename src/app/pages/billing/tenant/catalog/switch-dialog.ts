import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { AppI18nService } from '../../../../services/app-i18n.service';
import { DateTimeFormatService } from '../../../../services/date-time-format.service';
import { ReportProblemButtonComponent } from '../../../../shared/support-report-dialog/report-problem-button';
import { BillingSwitchPreview } from '../../shared/billing.service';

export interface BillingSwitchDialogData {
  offerName: string;
  preview: BillingSwitchPreview;
}

/**
 * Checkout review. The API decides coverage, credit and mode; this dialog only shows the quote the
 * tenant confirms: replaced contracts (same package line, or covered standalone products) end now with
 * a prorated credit or, on a downgrade, at the end of the paid period; partly covered products and
 * packages of other lines stay active and billed.
 */
@Component({
  selector: 'app-billing-switch-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog switch-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ title() | transloco }}</h2>
          <p>{{ data.offerName }}</p>
        </div>
        <mns-report-problem-button />
      </div>

      <div class="dialog-content">
        <p class="switch-intro">
          @if (scheduled()) {
            {{
              'This is a lower plan of the same product line. It starts when the period you already paid ends; nothing is charged now.'
                | transloco
            }}
          } @else if (switching()) {
            {{
              'This offer includes what you already pay for in other contracts. Review the change before confirming, so nothing is billed twice.'
                | transloco
            }}
          } @else {
            {{
              'You subscribe to packages, not to separate products. This package repeats modules of packages you already have; all of them stay active and billed.'
                | transloco
            }}
          }
        </p>

        @if (replaced().length) {
          <h3>
            {{ (scheduled() ? 'Replaced at the end of the period' : 'Replaced now') | transloco }}
          </h3>
          <ul class="switch-list">
            @for (contract of replaced(); track contract.subscriptionUUID) {
              <li>
                <mat-icon>swap_horiz</mat-icon>
                <div class="switch-line">
                  <strong>{{ contract.offerName }}</strong>
                  <span>{{
                    (contract.offerType === 'PACKAGE'
                      ? 'Same product line: the new package takes its place.'
                      : 'Everything in it is included in the new offer.'
                    ) | transloco
                  }}</span>
                </div>
                @if (!scheduled()) {
                  <span class="switch-amount">{{ money(contract.creditAmount) }}</span>
                }
              </li>
            }
          </ul>
          @if (!scheduled()) {
            <p class="switch-note">
              {{
                'Replaced contracts end now. The unused paid time returns to your prepaid balance.'
                  | transloco
              }}
            </p>
          }
        }

        @if (partial().length) {
          <h3>{{ 'Kept and still billed' | transloco }}</h3>
          <ul class="switch-list">
            @for (contract of partial(); track contract.subscriptionUUID) {
              <li>
                <mat-icon>warning</mat-icon>
                <div class="switch-line">
                  <strong>{{ contract.offerName }}</strong>
                  <span>{{ 'Only part of it is in the new offer.' | transloco }}</span>
                </div>
              </li>
            }
          </ul>
          <p class="switch-note switch-warning">
            {{
              'These contracts continue and keep being charged. Cancel them separately if you no longer need them.'
                | transloco
            }}
          </p>
        }

        @if (kept().length) {
          <h3>{{ 'Other packages you keep' | transloco }}</h3>
          <ul class="switch-list">
            @for (contract of kept(); track contract.subscriptionUUID) {
              <li>
                <mat-icon>inventory_2</mat-icon>
                <div class="switch-line">
                  <strong>{{ contract.offerName }}</strong>
                  @if (contract.sharedModules) {
                    <span
                      >{{ 'Modules also in the new package' | transloco }}:
                      {{ contract.sharedModules }}</span
                    >
                  }
                </div>
              </li>
            }
          </ul>
          <p class="switch-note">
            {{ 'Each package is a separate contract and both are billed.' | transloco }}
          </p>
        }

        @if (scheduledChanges().length) {
          <h3>{{ 'Scheduled changes canceled' | transloco }}</h3>
          <ul class="switch-list">
            @for (change of scheduledChanges(); track change.subscriptionUUID) {
              <li>
                <mat-icon>event_busy</mat-icon>
                <div class="switch-line">
                  <strong>{{ change.offerName }}</strong>
                  <span
                    >{{ 'Would start on' | transloco }} {{ date(change.scheduledStartAt) }}</span
                  >
                </div>
              </li>
            }
          </ul>
        }

        <dl class="switch-summary">
          @if (data.preview.setupAmount > 0) {
            <dt>{{ 'Setup' | transloco }}</dt>
            <dd>{{ money(data.preview.setupAmount) }}</dd>
          }
          @if (scheduled()) {
            <dt>{{ 'Starts on' | transloco }}</dt>
            <dd>{{ date(data.preview.effectiveAt) }}</dd>
            <dt>{{ 'Monthly charge from then' | transloco }}</dt>
            <dd>{{ money(data.preview.chargeAmount) }}</dd>
          } @else {
            <dt>{{ 'New offer charge' | transloco }}</dt>
            <dd>{{ money(data.preview.chargeAmount) }}</dd>
            @if (data.preview.creditAmount > 0 || replaced().length) {
              <dt>{{ 'Credit for unused time' | transloco }}</dt>
              <dd>- {{ money(data.preview.creditAmount) }}</dd>
            }
          }
          <dt class="switch-total">
            {{ (data.preview.netAmount >= 0 ? 'To pay now' : 'Added to your balance') | transloco }}
          </dt>
          <dd class="switch-total">{{ money(absNet()) }}</dd>
          <dt>{{ 'Available balance' | transloco }}</dt>
          <dd>{{ money(data.preview.availableBalance) }}</dd>
        </dl>
        @if (insufficient()) {
          <p class="switch-note switch-warning">{{ 'Insufficient prepaid credit.' | transloco }}</p>
        }
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(false)">
            {{ 'Cancel' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <div class="save-split-action is-single-action">
            <button
              mat-flat-button
              color="primary"
              type="button"
              class="save-main-button"
              (click)="dialogRef.close(true)"
            >
              <mat-icon>{{ switching() ? 'swap_horiz' : 'add_shopping_cart' }}</mat-icon>
              {{ confirmLabel() | transloco }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .switch-intro {
      margin: 0 0 12px;
    }
    h3 {
      margin: 16px 0 8px;
      font-size: 1rem;
    }
    .switch-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .switch-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-color-outline-variant);
    }
    .switch-line {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .switch-line span,
    .switch-note {
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.875rem;
    }
    .switch-amount {
      white-space: nowrap;
    }
    .switch-warning {
      color: var(--mat-sys-color-error);
    }
    .switch-summary {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px 16px;
      margin: 16px 0 0;
    }
    .switch-summary dd {
      margin: 0;
      text-align: right;
      white-space: nowrap;
    }
    .switch-total {
      font-weight: 600;
    }
  `,
})
export class BillingSwitchDialogComponent {
  readonly data = inject<BillingSwitchDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<BillingSwitchDialogComponent>);
  private readonly appI18n = inject(AppI18nService);
  private readonly dateTime = inject(DateTimeFormatService);

  readonly replaced = computed(() =>
    this.data.preview.contracts.filter((c) => c.coverage === 'FULL'),
  );
  readonly partial = computed(() =>
    this.data.preview.contracts.filter((c) => c.coverage === 'PARTIAL'),
  );
  readonly kept = computed(() => this.data.preview.contracts.filter((c) => c.coverage === 'INFO'));
  readonly scheduledChanges = computed(() => this.data.preview.scheduledChanges ?? []);
  readonly scheduled = computed(() => this.data.preview.mode === 'SCHEDULED');
  /** Replaces or partly repeats something; otherwise the offer is only added next to other packages. */
  readonly switching = computed(() => this.replaced().length + this.partial().length > 0);
  readonly title = computed(() =>
    this.scheduled()
      ? 'Schedule plan change'
      : this.switching()
        ? 'Switch to this offer'
        : 'Subscribe to this package too',
  );
  readonly confirmLabel = computed(() =>
    this.scheduled() ? 'Schedule change' : this.switching() ? 'Confirm switch' : 'Subscribe',
  );
  readonly absNet = computed(() => Math.abs(this.data.preview.netAmount));
  readonly insufficient = computed(
    () => this.data.preview.netAmount > this.data.preview.availableBalance,
  );

  date(value: string | null | undefined): string {
    return this.dateTime.formatDate(value, 'short') || '-';
  }

  money(value: number): string {
    const currency = /^[A-Z]{3}$/.test(this.data.preview.currency)
      ? this.data.preview.currency
      : 'BRL';
    try {
      return new Intl.NumberFormat(this.appI18n.language(), { style: 'currency', currency }).format(
        Number(value) || 0,
      );
    } catch {
      return `${currency} ${(Number(value) || 0).toFixed(2)}`;
    }
  }
}
