import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CurrencyMaskDirective,
  parseCurrencyAmount,
} from '../../../../shared/currency-mask/currency-mask.directive';
import { BillingTenantLookupItem, BillingService } from '../../shared/billing.service';
import { ReportProblemButtonComponent } from '../../../../shared/support-report-dialog/report-problem-button';
import { FieldInvalidDirective } from '../../../../shared/forms/field-invalid.directive';
import { injectRevealInvalidFields } from '../../../../shared/forms/reveal-invalid-fields';

export type BillingManualCreditDialogData = BillingTenantLookupItem;

@Component({
  selector: 'app-billing-manual-credit-dialog',
  standalone: true,
  imports: [
    FieldInvalidDirective,
    ReportProblemButtonComponent,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    CurrencyMaskDirective,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Manual credit' | transloco }}</h2>
          <p>{{ 'Apply an audited credit to this tenant wallet.' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </div>

      <div class="dialog-content">
        <mat-tab-group class="form-tabs crud-tabs">
          <mat-tab [label]="'Record' | transloco">
            <div class="tab-content form-grid">
              <mat-form-field appearance="outline" class="span-1">
                <mat-label>{{ 'Tenant' | transloco }}</mat-label>
                <input matInput [value]="tenantLabel()" readonly />
              </mat-form-field>
              <mat-form-field appearance="outline" class="span-1">
                <mat-label>{{ 'Currency' | transloco }}</mat-label>
                <input matInput [value]="currency()" readonly />
              </mat-form-field>
              <mat-form-field appearance="outline" class="span-1">
                <mat-label>{{ 'Amount' | transloco }} ({{ currency() }})*</mat-label>
                <input
                  matInput
                  type="text"
                  appCurrencyMask
                  [appCurrencyMaskCurrency]="currency()"
                  [value]="amount()"
                  (input)="amount.set($any($event.target).value)"
                  [mnsInvalid]="amountInvalid()"
                  required
                />
                <mat-error>{{ 'Amount must be greater than zero.' | transloco }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" class="span-4">
                <mat-label>{{ 'Reason' | transloco }}*</mat-label>
                <textarea
                  matInput
                  rows="4"
                  [value]="reason()"
                  (input)="reason.set($any($event.target).value)"
                  [mnsInvalid]="reasonInvalid()"
                ></textarea>
                <mat-error>{{ 'form.validation.required' | transloco }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" class="span-1">
                <mat-label>{{ 'Reference' | transloco }}</mat-label>
                <input
                  matInput
                  [value]="reference()"
                  (input)="reference.set($any($event.target).value)"
                />
              </mat-form-field>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" [disabled]="saving()" (click)="close()">
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
              [disabled]="saving()"
              (click)="save()"
            >
              <mat-icon>save</mat-icon>{{ 'Manual credit' | transloco }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class BillingManualCreditDialogComponent {
  private readonly data = inject<BillingManualCreditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<BillingManualCreditDialogComponent>);
  private readonly billing = inject(BillingService);
  private readonly snack = inject(SnackbarService);

  readonly amount = signal('');
  readonly reason = signal('');
  readonly reference = signal('');
  readonly saving = signal(false);
  readonly currency = computed(() => this.data.DefaultCurrency || 'BRL');
  readonly tenantLabel = computed(() => this.data.EnvironmentName || this.data.EnvironmentUUID);
  readonly amountValue = computed(
    () => parseCurrencyAmount(this.amount(), this.currencyLocale()) ?? 0,
  );
  readonly valid = computed(() => this.amountValue() > 0 && Boolean(this.reason().trim()));
  /** Required Field Feedback Baseline: invalid fields turn red after the first save attempt. */
  readonly submitAttempted = signal(false);
  readonly amountInvalid = computed(() => this.submitAttempted() && this.amountValue() <= 0);
  readonly reasonInvalid = computed(() => this.submitAttempted() && !this.reason().trim());
  private readonly revealInvalid = injectRevealInvalidFields();

  close(): void {
    this.dialogRef.close(false);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    if (!this.valid()) {
      this.submitAttempted.set(true);
      return this.revealInvalid();
    }
    this.saving.set(true);
    try {
      await this.billing.manualCredit({
        environmentUUID: this.data.EnvironmentUUID,
        amount: this.amountValue(),
        currency: this.currency(),
        reason: this.reason().trim(),
        reference: this.reference().trim() || null,
        idempotencyKey: crypto.randomUUID(),
      });
      this.snack.success('Manual credit applied successfully.');
      this.dialogRef.close(true);
    } catch (error: any) {
      this.snack.error(error?.error?.error || error?.message || 'Failed to apply manual credit.');
    } finally {
      this.saving.set(false);
    }
  }

  private currencyLocale(): string {
    return (
      ({ BRL: 'pt-BR', EUR: 'de-DE', GBP: 'en-GB', USD: 'en-US' } as Record<string, string>)[
        this.currency().toUpperCase()
      ] ?? 'pt-BR'
    );
  }
}
