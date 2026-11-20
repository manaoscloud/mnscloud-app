import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

import { AppI18nService } from '../../../../services/app-i18n.service';
import { DateTimeFormatService } from '../../../../services/date-time-format.service';
import { ReportProblemButtonComponent } from '../../../../shared/support-report-dialog/report-problem-button';
import {
  BillingCheckoutQuote,
  BillingService,
  BillingTermOffer,
} from '../../shared/billing.service';

export interface BillingCheckoutDialogData {
  offerName: string;
  priceUUID: string;
  offerType: string;
  offerUUID: string;
  terms: BillingTermOffer[];
}

export interface BillingCheckoutDialogResult {
  termMonths: number;
  promotionCode: string | null;
}

/**
 * New subscription review. The tenant picks how long to prepay (monthly or a discounted term) and may
 * enter a coupon; every amount comes from the server quote, which the checkout recomputes.
 */
@Component({
  selector: 'app-billing-checkout-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Subscribe' | transloco }}</h2>
          <p>{{ data.offerName }}</p>
        </div>
        <mns-report-problem-button />
      </div>

      <div class="dialog-content">
        <div class="dialog-scroll">
          @if (data.terms.length) {
            <h3>{{ 'How long do you want to pay for?' | transloco }}</h3>
            <div class="term-options" role="radiogroup">
              @for (option of options(); track option.months) {
                <button
                  type="button"
                  class="term-option"
                  role="radio"
                  [attr.aria-checked]="months() === option.months"
                  [class.selected]="months() === option.months"
                  (click)="selectTerm(option.months)"
                >
                  <strong>{{
                    termLabel(option.months) | transloco: { months: option.months }
                  }}</strong>
                  @if (option.discountPercent > 0) {
                    <span class="term-badge"
                      >{{ 'Save' | transloco }} {{ option.discountPercent }}%</span
                    >
                  }
                </button>
              }
            </div>
          }

          <div class="coupon-row">
            <mat-form-field appearance="outline" class="coupon-field">
              <mat-label>{{ 'Coupon' | transloco }}</mat-label>
              <input
                matInput
                maxlength="120"
                [ngModel]="coupon()"
                (ngModelChange)="coupon.set($event)"
                (keydown.enter)="applyCoupon()"
              />
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="applyCoupon()" [disabled]="loading()">
              {{ 'Apply' | transloco }}
            </button>
          </div>

          @if (quote(); as q) {
            @if (q.promotionNote === 'TERM_DISCOUNT_IS_BETTER') {
              <p class="checkout-note">
                {{
                  'The discount of this term is larger than the coupon, so the coupon is not used.'
                    | transloco
                }}
              </p>
            } @else if (q.promotionApplied) {
              <p class="checkout-note">{{ 'Coupon applied' | transloco }}: {{ q.promotionCode }}</p>
            }
            <dl class="checkout-summary">
              @if (q.termMonths > 1) {
                <dt>{{ 'Monthly equivalent' | transloco }}</dt>
                <dd>{{ money(q.monthlyAmount) }}</dd>
                <dt>{{ 'Monthly price without the term' | transloco }}</dt>
                <dd>{{ money(q.monthlyFullAmount) }}</dd>
              }
              @if (q.setupAmount > 0) {
                <dt>{{ 'Setup' | transloco }}</dt>
                <dd>{{ money(q.setupAmount) }}</dd>
              }
              <dt>{{ 'Charge for the period' | transloco }}</dt>
              <dd>{{ money(q.chargeAmount) }}</dd>
              @if (q.savingsAmount > 0) {
                <dt>{{ 'You save' | transloco }}</dt>
                <dd class="checkout-saving">{{ money(q.savingsAmount) }}</dd>
              }
              <dt class="checkout-total">{{ 'To pay now' | transloco }}</dt>
              <dd class="checkout-total">{{ money(q.totalAmount) }}</dd>
              @if (q.periodEnd) {
                <dt>{{ 'Paid until' | transloco }}</dt>
                <dd>{{ date(q.periodEnd) }}</dd>
              }
              @if (q.renewalAmount !== null) {
                <dt>{{ 'Renewal amount' | transloco }}</dt>
                <dd>{{ money(q.renewalAmount) }}</dd>
              }
              <dt>{{ 'Available balance' | transloco }}</dt>
              <dd>{{ money(q.availableBalance) }}</dd>
            </dl>
            @if (q.termMonths > 1) {
              <p class="checkout-note">
                {{
                  'The whole term is charged now from your prepaid balance and the price is locked until it ends. It renews for the same term unless you choose to continue monthly. Canceling within 7 days returns everything to your balance; later, the months used are recalculated at the discount of the term you completed and the rest returns to your balance.'
                    | transloco
                }}
              </p>
            } @else {
              <p class="checkout-note">
                {{
                  'Monthly contracts renew automatically from your prepaid balance; access is suspended if funds are insufficient.'
                    | transloco
                }}
              </p>
            }
            @if (insufficient()) {
              <p class="checkout-note checkout-warning">
                {{ 'Insufficient prepaid credit.' | transloco }}
              </p>
            }
          }
        </div>
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(null)">
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
              [disabled]="loading() || !quote()"
              (click)="confirm()"
            >
              <mat-icon>add_shopping_cart</mat-icon>
              {{ 'Subscribe' | transloco }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    h3 {
      margin: 0 0 8px;
      font-size: 1rem;
    }
    .term-options {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .term-option {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid var(--mat-sys-color-outline-variant);
      border-radius: 12px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    .term-option.selected {
      border-color: var(--mat-sys-color-primary);
      box-shadow: inset 0 0 0 1px var(--mat-sys-color-primary);
    }
    .term-badge {
      font-size: 0.8rem;
      color: var(--mat-sys-color-primary);
    }
    .coupon-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .coupon-field {
      flex: 1;
      min-width: 0;
    }
    .coupon-row button {
      margin-top: 8px;
    }
    .checkout-summary {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px 16px;
      margin: 8px 0 0;
    }
    .checkout-summary dd {
      margin: 0;
      text-align: right;
      white-space: nowrap;
    }
    .checkout-total {
      font-weight: 600;
    }
    .checkout-saving {
      color: var(--mat-sys-color-primary);
    }
    .checkout-note {
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.875rem;
      margin: 8px 0 0;
    }
    .checkout-warning {
      color: var(--mat-sys-color-error);
    }
  `,
})
export class BillingCheckoutDialogComponent implements OnInit {
  readonly data = inject<BillingCheckoutDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<BillingCheckoutDialogComponent>);
  private readonly billing = inject(BillingService);
  private readonly appI18n = inject(AppI18nService);
  private readonly dateTime = inject(DateTimeFormatService);

  readonly months = signal(1);
  readonly coupon = signal('');
  /** Coupon currently priced by the quote (the field may hold an unapplied edit). */
  private readonly appliedCoupon = signal<string | null>(null);
  readonly quote = signal<BillingCheckoutQuote | null>(null);
  readonly loading = signal(false);
  readonly options = computed(() => [
    { months: 1, discountPercent: 0 },
    ...this.data.terms.map((term) => ({
      months: term.months,
      discountPercent: Number(term.discountPercent) || 0,
    })),
  ]);
  readonly insufficient = computed(() => {
    const q = this.quote();
    return q ? q.totalAmount > q.availableBalance : false;
  });

  ngOnInit(): void {
    void this.refresh(1, null);
  }

  termLabel(months: number): string {
    return months === 1 ? 'Monthly' : '{{months}} months';
  }

  selectTerm(months: number): void {
    if (this.months() === months || this.loading()) return;
    void this.refresh(months, this.appliedCoupon());
  }

  applyCoupon(): void {
    if (this.loading()) return;
    const code = this.coupon().trim();
    void this.refresh(this.months(), code || null);
  }

  confirm(): void {
    const quote = this.quote();
    if (!quote) return;
    const result: BillingCheckoutDialogResult = {
      termMonths: quote.termMonths,
      promotionCode: quote.promotionApplied ? this.appliedCoupon() : null,
    };
    this.dialogRef.close(result);
  }

  /** The selection changes only with a quote the server accepted, so the confirmed terms are the shown ones. */
  private async refresh(months: number, code: string | null): Promise<void> {
    this.loading.set(true);
    try {
      const quote = await this.billing.checkoutQuote(
        this.data.priceUUID,
        this.data.offerType,
        this.data.offerUUID,
        months,
        code,
      );
      if (!quote) return;
      this.quote.set(quote);
      this.months.set(months);
      this.appliedCoupon.set(code);
    } catch {
      // The API interceptor presents the rejection (invalid coupon, term not offered); keep the last quote.
      this.coupon.set(this.appliedCoupon() ?? '');
    } finally {
      this.loading.set(false);
    }
  }

  date(value: string | null | undefined): string {
    return this.dateTime.formatDate(value, 'short') || '-';
  }

  money(value: number | null | undefined): string {
    const raw = this.quote()?.currency ?? 'BRL';
    const currency = /^[A-Z]{3}$/.test(raw) ? raw : 'BRL';
    try {
      return new Intl.NumberFormat(this.appI18n.language(), { style: 'currency', currency }).format(
        Number(value) || 0,
      );
    } catch {
      return `${currency} ${(Number(value) || 0).toFixed(2)}`;
    }
  }
}
