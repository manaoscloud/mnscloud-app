import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import { AppI18nService } from '../../../../services/app-i18n.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { ReportProblemButtonComponent } from '../../../../shared/support-report-dialog/report-problem-button';
import {
  BillingPriceTerm,
  BillingPriceTermLadderResult,
  BillingService,
} from '../../shared/billing.service';

export interface BillingPriceTermsDialogData {
  priceUUID: string;
  priceName: string;
  currency: string;
  unitPrice: number;
}

const TERM_MONTHS = [3, 6, 12, 24, 36] as const;

/**
 * Prepaid terms of a monthly price (master). The database validates each term (months, discount and
 * the VPS plan floor); this dialog only edits them and shows why a term is refused.
 */
@Component({
  selector: 'app-billing-price-terms-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Prepaid terms' | transloco }}</h2>
          <p>{{ data.priceName }} · {{ money(data.unitPrice) }} / {{ 'month' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </div>

      <div class="dialog-content">
        <div class="dialog-scroll">
          <p class="terms-note">
            {{
              'Tenants prepay the whole term at once with this discount on the monthly price. VPS plan prices never go below the plan minimum, and terms over 12 months need the plan cost in the plan currency.'
                | transloco
            }}
          </p>

          <ul class="terms-list">
            @for (term of terms(); track term.BtmUUID) {
              <li>
                <div class="terms-line">
                  <strong
                    >{{ term.BtmMonths }} {{ 'months' | transloco }} ·
                    {{ term.BtmDiscountPercent }}%</strong
                  >
                  <span>
                    {{ 'Monthly equivalent' | transloco }}: {{ money(term.MonthlyAmount) }} ·
                    {{ 'Total' | transloco }}: {{ money(term.TotalAmount) }}
                    @if (isTrue(term.BtmSetupWaive)) {
                      · {{ 'Setup waived' | transloco }}
                    }
                  </span>
                  @if (term.FloorError) {
                    <span class="terms-error">{{ term.FloorError | transloco }}</span>
                  }
                </div>
                <button
                  mat-icon-button
                  type="button"
                  [attr.aria-label]="'Edit' | transloco"
                  (click)="edit(term)"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  [attr.aria-label]="'Delete' | transloco"
                  (click)="remove(term)"
                  [disabled]="busy()"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </li>
            } @empty {
              <li>{{ 'No prepaid terms; this price is sold monthly only.' | transloco }}</li>
            }
          </ul>

          <h3>{{ 'Add or change a term' | transloco }}</h3>
          <div class="form-grid terms-form">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'Term' | transloco }}</mat-label>
              <mat-select [ngModel]="months()" (ngModelChange)="months.set($event)">
                @for (option of monthOptions; track option) {
                  <mat-option [value]="option">{{ option }} {{ 'months' | transloco }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'Discount (%)' | transloco }}</mat-label>
              <input
                matInput
                type="number"
                min="0"
                max="90"
                step="0.5"
                [ngModel]="discount()"
                (ngModelChange)="discount.set(+$event)"
              />
            </mat-form-field>
            <mat-checkbox [ngModel]="setupWaive()" (ngModelChange)="setupWaive.set($event)">
              {{ 'Waive setup' | transloco }}
            </mat-checkbox>
            <button
              mat-stroked-button
              type="button"
              (click)="save()"
              [disabled]="busy() || !valid()"
            >
              <mat-icon>save</mat-icon>
              {{ 'Save term' | transloco }}
            </button>
          </div>

          @if (ladderResult().length) {
            <ul class="ladder-result">
              @for (item of ladderResult(); track item.Months) {
                <li [class.terms-error]="!item.Applied">
                  {{ item.Months }} {{ 'months' | transloco }}: {{ item.DiscountPercent }}% —
                  {{ (item.Applied ? 'Applied' : (item.Reason ?? 'Not applied')) | transloco }}
                </li>
              }
            </ul>
          }
        </div>
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close(true)">
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <div class="save-split-action is-single-action">
            <button
              mat-flat-button
              color="primary"
              type="button"
              class="save-main-button"
              (click)="applyLadder()"
              [disabled]="busy()"
            >
              <mat-icon>stairs</mat-icon>
              {{ 'Apply default ladder' | transloco }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .terms-note {
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.875rem;
      margin: 0 0 12px;
    }
    h3 {
      margin: 16px 0 8px;
      font-size: 1rem;
    }
    .terms-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .terms-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-color-outline-variant);
    }
    .terms-line {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .terms-line span {
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.875rem;
    }
    .terms-error,
    .terms-line .terms-error {
      color: var(--mat-sys-color-error);
      font-size: 0.875rem;
    }
    .terms-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      align-items: center;
    }
    .terms-form > * {
      min-width: 0;
    }
    .ladder-result {
      margin: 12px 0 0;
      padding-left: 18px;
      font-size: 0.875rem;
    }
  `,
})
export class BillingPriceTermsDialogComponent implements OnInit {
  readonly data = inject<BillingPriceTermsDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<BillingPriceTermsDialogComponent>);
  private readonly billing = inject(BillingService);
  private readonly appI18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);

  readonly monthOptions = TERM_MONTHS;
  readonly terms = signal<BillingPriceTerm[]>([]);
  readonly ladderResult = signal<BillingPriceTermLadderResult[]>([]);
  readonly busy = signal(false);
  readonly months = signal<number>(12);
  readonly discount = signal<number>(20);
  readonly setupWaive = signal(false);
  readonly valid = computed(
    () => Number.isFinite(this.discount()) && this.discount() >= 0 && this.discount() <= 90,
  );

  ngOnInit(): void {
    void this.reload();
  }

  isTrue(value: unknown): boolean {
    return value === true || Number(value) === 1;
  }

  edit(term: BillingPriceTerm): void {
    this.months.set(Number(term.BtmMonths));
    this.discount.set(Number(term.BtmDiscountPercent));
    this.setupWaive.set(this.isTrue(term.BtmSetupWaive));
  }

  async save(): Promise<void> {
    await this.run(async () => {
      this.terms.set(
        await this.billing.savePriceTerm(this.data.priceUUID, this.months(), {
          discountPercent: this.discount(),
          setupWaive: this.setupWaive(),
          status: true,
        }),
      );
      this.snack.success('Prepaid term saved.');
    });
  }

  async remove(term: BillingPriceTerm): Promise<void> {
    await this.run(async () => {
      await this.billing.deletePriceTerm(term.BtmUUID);
      await this.reload();
      this.snack.success('Prepaid term removed.');
    });
  }

  async applyLadder(): Promise<void> {
    await this.run(async () => {
      this.ladderResult.set(await this.billing.applyPriceTermLadder(this.data.priceUUID));
      await this.reload();
    });
  }

  private async reload(): Promise<void> {
    try {
      this.terms.set(await this.billing.listPriceTerms(this.data.priceUUID));
    } catch {
      // The API interceptor presents the rejection.
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
    } catch {
      // The API interceptor presents the rejection (floor, months, discount).
    } finally {
      this.busy.set(false);
    }
  }

  money(value: number | null | undefined): string {
    const currency = /^[A-Z]{3}$/.test(this.data.currency) ? this.data.currency : 'BRL';
    try {
      return new Intl.NumberFormat(this.appI18n.language(), { style: 'currency', currency }).format(
        Number(value) || 0,
      );
    } catch {
      return `${currency} ${(Number(value) || 0).toFixed(2)}`;
    }
  }
}
