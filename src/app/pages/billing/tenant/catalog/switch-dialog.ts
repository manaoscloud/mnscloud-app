import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { AppI18nService } from '../../../../services/app-i18n.service';
import { ReportProblemButtonComponent } from '../../../../shared/support-report-dialog/report-problem-button';
import { BillingSwitchContract, BillingSwitchPreview } from '../../shared/billing.service';

export interface BillingSwitchDialogData {
  offerName: string;
  preview: BillingSwitchPreview;
}

/**
 * Plan switch review. The API decides coverage and credit; this dialog only shows the quote the
 * tenant confirms (replaced contracts end now with a prorated credit, partial ones stay billed).
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
          <h2>{{ 'Switch to this offer' | transloco }}</h2>
          <p>{{ data.offerName }}</p>
        </div>
        <mns-report-problem-button />
      </div>

      <div class="dialog-content">
        <p class="switch-intro">
          {{
            'This offer includes what you already pay for in other contracts. Review the change before confirming, so nothing is billed twice.'
              | transloco
          }}
        </p>

        @if (replaced().length) {
          <h3>{{ 'Replaced now' | transloco }}</h3>
          <ul class="switch-list">
            @for (contract of replaced(); track contract.subscriptionUUID) {
              <li>
                <mat-icon>swap_horiz</mat-icon>
                <div class="switch-line">
                  <strong>{{ contract.offerName }}</strong>
                  <span>{{ coverageLabel(contract) | transloco }}</span>
                </div>
                <span class="switch-amount">{{ money(contract.creditAmount) }}</span>
              </li>
            }
          </ul>
          <p class="switch-note">
            {{
              'Replaced contracts end now. The unused paid time returns to your prepaid balance.'
                | transloco
            }}
          </p>
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

        <dl class="switch-summary">
          @if (data.preview.setupAmount > 0) {
            <dt>{{ 'Setup' | transloco }}</dt>
            <dd>{{ money(data.preview.setupAmount) }}</dd>
          }
          <dt>{{ 'New offer charge' | transloco }}</dt>
          <dd>{{ money(data.preview.chargeAmount) }}</dd>
          <dt>{{ 'Credit for unused time' | transloco }}</dt>
          <dd>- {{ money(data.preview.creditAmount) }}</dd>
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
              <mat-icon>swap_horiz</mat-icon>{{ 'Confirm switch' | transloco }}
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

  readonly replaced = computed(() =>
    this.data.preview.contracts.filter((c) => c.coverage === 'FULL' || c.coverage === 'BASE'),
  );
  readonly partial = computed(() =>
    this.data.preview.contracts.filter((c) => c.coverage === 'PARTIAL'),
  );
  readonly absNet = computed(() => Math.abs(this.data.preview.netAmount));
  readonly insufficient = computed(
    () => this.data.preview.netAmount > this.data.preview.availableBalance,
  );

  coverageLabel(contract: BillingSwitchContract): string {
    return contract.coverage === 'BASE'
      ? 'Your current base plan is replaced.'
      : 'Everything in it is included in the new offer.';
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
