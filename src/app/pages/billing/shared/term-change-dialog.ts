import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { AppI18nService } from '../../../services/app-i18n.service';
import { DateTimeFormatService } from '../../../services/date-time-format.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';

export interface TermChangeOption {
  months: number;
  discountPercent: number;
  totalAmount?: number | null;
}

/** Prepaid terms a contract can move to. */
export const PREPAID_TERM_MONTHS = [3, 6, 12, 24, 36] as const;

/** Server quote of a term change: charge of the new term, credit of the current one, net to pay. */
export interface TermChangePreview {
  discountPercent: number;
  chargeAmount: number;
  setupAmount: number;
  creditAmount: number | null;
  netAmount: number | null;
  periodEnd: string | null;
  availableBalance: number | null;
}

export interface TermChangeDialogData {
  title: string;
  subjectName: string;
  currency: string;
  currentMonths: number;
  options: TermChangeOption[];
  /** Server quote for the selected term (optional: without it the option totals are shown). */
  preview?: (months: number) => Promise<TermChangePreview | null>;
}

/**
 * Prepay a longer term for something already contracted. The server computes every amount and credits
 * the unused paid time of the current contract; the dialog only shows the quote and returns the term.
 */
@Component({
  selector: 'app-term-change-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, ReportProblemButtonComponent, TranslocoPipe],
  template: `
    <div class="crud-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ data.title | transloco }}</h2>
          <p>{{ data.subjectName }}</p>
        </div>
        <mns-report-problem-button />
      </div>

      <div class="dialog-content">
        <div class="dialog-scroll">
          @if (options().length) {
            <div class="term-options" role="radiogroup">
              @for (option of options(); track option.months) {
                <button
                  type="button"
                  class="term-option"
                  role="radio"
                  [attr.aria-checked]="months() === option.months"
                  [class.selected]="months() === option.months"
                  (click)="select(option.months)"
                >
                  <strong>{{ option.months }} {{ 'months' | transloco }}</strong>
                  @if (option.discountPercent > 0) {
                    <span class="term-badge"
                      >{{ 'Save' | transloco }} {{ option.discountPercent }}%</span
                    >
                  }
                  @if (option.totalAmount) {
                    <span>{{ money(option.totalAmount) }}</span>
                  }
                </button>
              }
            </div>
          } @else {
            <p class="term-note">
              {{ 'No longer prepaid term is offered for this plan.' | transloco }}
            </p>
          }

          @if (preview(); as q) {
            <dl class="term-summary">
              @if (q.discountPercent > 0) {
                <dt>{{ 'Term discount' | transloco }}</dt>
                <dd>{{ q.discountPercent }}%</dd>
              }
              <dt>{{ 'Charge for the period' | transloco }}</dt>
              <dd>{{ money(q.chargeAmount) }}</dd>
              @if (q.setupAmount > 0) {
                <dt>{{ 'Setup' | transloco }}</dt>
                <dd>{{ money(q.setupAmount) }}</dd>
              }
              @if (q.creditAmount !== null) {
                <dt>{{ 'Credit for unused time' | transloco }}</dt>
                <dd>- {{ money(q.creditAmount) }}</dd>
              }
              @if (q.netAmount !== null) {
                <dt class="term-total">{{ 'To pay now' | transloco }}</dt>
                <dd class="term-total">{{ money(q.netAmount) }}</dd>
              }
              @if (q.periodEnd) {
                <dt>{{ 'Paid until' | transloco }}</dt>
                <dd>{{ date(q.periodEnd) }}</dd>
              }
              @if (q.availableBalance !== null) {
                <dt>{{ 'Available balance' | transloco }}</dt>
                <dd>{{ money(q.availableBalance) }}</dd>
              }
            </dl>
          }
          <p class="term-note">
            {{
              'The current contract ends now and its unused paid time returns to your prepaid balance; the new term is charged from it and its price is locked until it ends.'
                | transloco
            }}
          </p>
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
              [disabled]="!months() || loading()"
              (click)="dialogRef.close(months())"
            >
              <mat-icon>event_repeat</mat-icon>
              {{ 'Confirm' | transloco }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
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
    .term-summary {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px 16px;
      margin: 8px 0 0;
    }
    .term-summary dd {
      margin: 0;
      text-align: right;
      white-space: nowrap;
    }
    .term-total {
      font-weight: 600;
    }
    .term-note {
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.875rem;
      margin: 8px 0 0;
    }
  `,
})
export class TermChangeDialogComponent {
  readonly data = inject<TermChangeDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<TermChangeDialogComponent>);
  private readonly appI18n = inject(AppI18nService);
  private readonly dateTime = inject(DateTimeFormatService);

  readonly months = signal<number | null>(null);
  readonly preview = signal<TermChangePreview | null>(null);
  readonly loading = signal(false);
  readonly options = computed(() =>
    this.data.options
      .filter((option) => option.months > this.data.currentMonths)
      .sort((a, b) => a.months - b.months),
  );

  async select(months: number): Promise<void> {
    if (this.loading()) return;
    if (!this.data.preview) {
      this.months.set(months);
      return;
    }
    this.loading.set(true);
    try {
      const quote = await this.data.preview(months);
      if (quote) {
        this.preview.set(quote);
        this.months.set(months);
      }
    } catch {
      // The API interceptor presents the rejection (term not offered, plan floor).
    } finally {
      this.loading.set(false);
    }
  }

  date(value: string | null | undefined): string {
    return this.dateTime.formatDate(value, 'short') || '-';
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

/** Opens the term change dialog; resolves with the chosen term in months, or null. */
export function openTermChangeDialog(
  dialog: MatDialog,
  destroyRef: DestroyRef,
  data: TermChangeDialogData,
): Promise<number | null> {
  return new Promise((resolve) => {
    const binding = openCrudComponentDialog(dialog, TermChangeDialogComponent, 'crud-form-dialog', {
      data,
      onEscape: () => binding.ref.close(null),
    });
    bindDialogClosed(
      binding.ref,
      (result) => {
        binding.stop();
        resolve(typeof result === 'number' && result > 1 ? result : null);
      },
      destroyRef,
    );
  });
}
