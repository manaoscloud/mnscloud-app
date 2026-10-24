import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import { AppI18nService } from '../../services/app-i18n.service';
import { DateMaskDirective } from '../date-mask/date-mask.directive';
import { formatDateInput, parseDateInput, toDateOnly } from '../date-mask/date-input-format';
import { FieldInvalidDirective } from '../forms/field-invalid.directive';
import { injectRevealInvalidFields } from '../forms/reveal-invalid-fields';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';
import { PERSON_LOOKUP_LEGAL_BASES, PERSON_LOOKUP_PURPOSES } from './person-lookup-options';

export type PersonLookupDialogData = {
  cpf: string;
  /** Date of birth already in the form (any accepted date input); optional. */
  birthDate: unknown;
};

export type PersonLookupDialogResult = {
  purpose: string;
  legalBasis: string;
  /** `YYYY-MM-DD`, or empty when not informed. */
  birthDate: string;
};

/** Purpose and legal basis (LGPD) declared before a CPF lookup; both are recorded per query. */
@Component({
  selector: 'app-person-lookup-dialog',
  standalone: true,
  imports: [
    DateMaskDirective,
    FieldInvalidDirective,
    MatButtonModule,
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
          <h2>{{ 'Search CPF' | transloco }}</h2>
          <p>
            {{
              'CPF lookups are personal data processing (LGPD): declare why and on which legal basis. Both are recorded with the query.'
                | transloco
            }}
          </p>
        </div>
        <mns-report-problem-button />
      </div>

      <div class="dialog-content">
        <div class="tab-content form-grid">
          <mat-form-field appearance="outline" class="span-4">
            <mat-label>{{ 'CPF' | transloco }}</mat-label>
            <input matInput [value]="cpfLabel" readonly />
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-4">
            <mat-label>{{ 'Date of birth' | transloco }}</mat-label>
            <input
              matInput
              appDateMask
              [value]="birthDate()"
              (input)="birthDate.set($any($event.target).value)"
              [mnsInvalid]="birthDateInvalid()"
            />
            <mat-hint>{{
              'Some providers confirm the CPF with the date of birth.' | transloco
            }}</mat-hint>
            <mat-error>{{ 'Invalid date.' | transloco }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-4">
            <mat-label>{{ 'Purpose' | transloco }}*</mat-label>
            <mat-select
              [value]="purpose()"
              (valueChange)="purpose.set($event)"
              [mnsInvalid]="purposeInvalid()"
            >
              @for (option of purposes; track option.value) {
                <mat-option [value]="option.value">{{ option.label | transloco }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'form.validation.required' | transloco }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-4">
            <mat-label>{{ 'Legal basis' | transloco }}*</mat-label>
            <mat-select
              [value]="legalBasis()"
              (valueChange)="legalBasis.set($event)"
              [mnsInvalid]="legalBasisInvalid()"
            >
              @for (option of legalBases; track option.value) {
                <mat-option [value]="option.value">{{ option.label | transloco }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ 'form.validation.required' | transloco }}</mat-error>
          </mat-form-field>
        </div>
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="close()">
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
              (click)="search()"
            >
              <mat-icon>person_search</mat-icon>{{ 'Search CPF' | transloco }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PersonLookupDialogComponent {
  private readonly data = inject<PersonLookupDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<PersonLookupDialogComponent, PersonLookupDialogResult>>(MatDialogRef);
  private readonly i18n = inject(AppI18nService);
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly purposes = PERSON_LOOKUP_PURPOSES;
  readonly legalBases = PERSON_LOOKUP_LEGAL_BASES;
  readonly cpfLabel = this.data.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  // A lookup from a registration form is, by default, for that registration.
  readonly purpose = signal('registration');
  readonly legalBasis = signal('');
  readonly birthDate = signal(this.initialBirthDate());
  /** Required Field Feedback Baseline: invalid fields turn red after the first search attempt. */
  readonly submitAttempted = signal(false);
  private readonly birthDateIso = computed(() => {
    const value = this.birthDate().trim();
    return value ? toDateOnly(value, this.i18n.language()) : '';
  });
  readonly purposeInvalid = computed(() => this.submitAttempted() && !this.purpose());
  readonly legalBasisInvalid = computed(() => this.submitAttempted() && !this.legalBasis());
  readonly birthDateInvalid = computed(
    () => this.submitAttempted() && this.birthDateIso() === null,
  );

  close(): void {
    this.dialogRef.close();
  }

  search(): void {
    const birthDate = this.birthDateIso();
    if (!this.purpose() || !this.legalBasis() || birthDate === null) {
      this.submitAttempted.set(true);
      this.revealInvalid();
      return;
    }
    this.dialogRef.close({
      purpose: this.purpose(),
      legalBasis: this.legalBasis(),
      birthDate,
    });
  }

  private initialBirthDate(): string {
    const date = parseDateInput(this.data.birthDate, this.i18n.language());
    return date ? formatDateInput(date, this.i18n.language()) : '';
  }
}
