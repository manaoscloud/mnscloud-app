import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { DateMaskDirective } from '../../date-mask/date-mask.directive';
import { MnsDateAdapterModule } from '../../date-mask/mns-date-adapter.module';
import { MnsSearchSelectFieldComponent } from '../../forms/mns-search-select-field/mns-search-select-field';
import type {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';

export type ConfigurableCrudQuickCreateDialogData = {
  config: ConfigurableCrudConfig;
  title?: string;
  description?: string;
  initialValues?: ConfigurableCrudRecord;
  lookupOptions?: Record<string, readonly ConfigurableCrudOption[]>;
  optionFromResponse?: (
    response: unknown,
    payload: ConfigurableCrudRecord,
  ) => ConfigurableCrudOption | null;
};

export type ConfigurableCrudQuickCreateDialogResult = {
  response: unknown;
  payload: ConfigurableCrudRecord;
  option: ConfigurableCrudOption | null;
};

@Component({
  selector: 'app-configurable-crud-quick-create-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MnsDateAdapterModule,
    MnsSearchSelectFieldComponent,
    TranslocoPipe,
    DateMaskDirective,
  ],
  template: `
    <h2 mat-dialog-title>{{ title() | transloco }}</h2>
    <mat-dialog-content class="quick-create-content">
      <p class="quick-create-description">{{ description() | transloco }}</p>

      <div class="quick-create-grid">
        @for (field of visibleFields(); track field.key) {
          @switch (field.type) {
            @case ('select') {
              <mat-form-field appearance="outline" [class]="fieldClass(field)">
                <mat-label>{{ fieldLabel(field) | transloco }}{{ requiredMark(field) }}</mat-label>
                <mat-select
                  [value]="fieldValue(field.key)"
                  (selectionChange)="setFieldValue(field.key, $event.value)"
                >
                  @for (option of fieldOptions(field); track option.value) {
                    <mat-option [value]="option.value">{{
                      optionLabel(field, option) | transloco
                    }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
            @case ('status') {
              <mat-form-field appearance="outline" [class]="fieldClass(field)">
                <mat-label>{{ fieldLabel(field) | transloco }}{{ requiredMark(field) }}</mat-label>
                <mat-select
                  [value]="fieldValue(field.key)"
                  (selectionChange)="setFieldValue(field.key, $event.value)"
                >
                  <mat-option [value]="data.config.activeValue">{{
                    'Active' | transloco
                  }}</mat-option>
                  <mat-option [value]="data.config.inactiveValue">{{
                    'Inactive' | transloco
                  }}</mat-option>
                </mat-select>
              </mat-form-field>
            }
            @case ('search-select') {
              <mns-search-select-field
                [fieldClass]="fieldClass(field)"
                [label]="(fieldLabel(field) | transloco) + requiredMark(field)"
                [placeholder]="field.placeholder ?? 'Search'"
                [options]="fieldOptions(field)"
                [value]="fieldValue(field.key)"
                (valueChange)="setFieldValue(field.key, $event)"
              />
            }
            @case ('date') {
              <mat-form-field appearance="outline" [class]="fieldClass(field)">
                <mat-label>{{ fieldLabel(field) | transloco }}{{ requiredMark(field) }}</mat-label>
                <input
                  matInput
                  appDateMask
                  [matDatepicker]="picker"
                  [value]="fieldValue(field.key)"
                  (input)="setFieldValue(field.key, $any($event.target).value)"
                />
                <mat-datepicker-toggle matSuffix [for]="picker" />
                <mat-datepicker #picker touchUi />
              </mat-form-field>
            }
            @case ('textarea') {
              <mat-form-field appearance="outline" [class]="fieldClass(field)">
                <mat-label>{{ fieldLabel(field) | transloco }}{{ requiredMark(field) }}</mat-label>
                <textarea
                  matInput
                  [rows]="field.rows ?? 3"
                  [value]="fieldValue(field.key)"
                  (input)="setFieldValue(field.key, $any($event.target).value)"
                ></textarea>
              </mat-form-field>
            }
            @default {
              <mat-form-field appearance="outline" [class]="fieldClass(field)">
                <mat-label>{{ fieldLabel(field) | transloco }}{{ requiredMark(field) }}</mat-label>
                <input
                  matInput
                  [type]="
                    field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'
                  "
                  [value]="fieldValue(field.key)"
                  (input)="setFieldValue(field.key, $any($event.target).value)"
                  autocomplete="off"
                />
              </mat-form-field>
            }
          }
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close()" [disabled]="saving()">
        {{ 'Cancel' | transloco }}
      </button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="saving()">
        @if (saving()) {
          <mat-progress-spinner diameter="18" mode="indeterminate" />
        }
        <span>{{ 'Save' | transloco }}</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .quick-create-content {
        min-width: min(1040px, 78vw);
      }

      .quick-create-description {
        margin: 0 0 1rem;
        color: var(--mns-color-text-muted, rgba(255, 255, 255, 0.72));
      }

      .quick-create-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .span-1 {
        grid-column: span 1;
      }

      .span-2 {
        grid-column: span 2;
      }

      .span-3 {
        grid-column: span 3;
      }

      .span-4 {
        grid-column: span 4;
      }

      mat-form-field,
      mns-search-select-field {
        width: 100%;
        min-width: 0;
      }

      mat-dialog-actions mat-progress-spinner {
        display: inline-block;
        margin-right: 0.5rem;
      }

      @media (max-width: 820px) {
        .quick-create-content {
          min-width: 0;
        }

        .quick-create-grid {
          grid-template-columns: 1fr;
        }

        .span-1,
        .span-2,
        .span-3,
        .span-4 {
          grid-column: span 1;
        }
      }
    `,
  ],
})
export class ConfigurableCrudQuickCreateDialogComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialogRef = inject(
    MatDialogRef<
      ConfigurableCrudQuickCreateDialogComponent,
      ConfigurableCrudQuickCreateDialogResult
    >,
  );
  readonly data = inject<ConfigurableCrudQuickCreateDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly values = signal<ConfigurableCrudRecord>({
    ...this.data.config.initialValues,
    ...(this.data.initialValues ?? {}),
  });

  readonly title = computed(() => this.data.title ?? this.data.config.createTitle);
  readonly description = computed(
    () => this.data.description ?? this.data.config.dialogDescription,
  );
  readonly visibleFields = computed(() =>
    this.data.config.fields.filter(
      (field) => !field.hidden && !field.hiddenWhen?.({ editing: false, values: this.values() }),
    ),
  );

  fieldClass(field: ConfigurableCrudField): string {
    return `span-${field.span ?? 1}`;
  }

  fieldLabel(field: ConfigurableCrudField): string {
    return field.labelWhen?.({ editing: false, values: this.values() }) ?? field.label;
  }

  requiredMark(field: ConfigurableCrudField): string {
    return this.isRequired(field) ? '*' : '';
  }

  fieldValue(key: string): string | number | boolean | null {
    const value = this.values()[key];
    if (value === undefined || value === null) return '';
    return value as string | number | boolean | null;
  }

  setFieldValue(key: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [key]: value }));
  }

  fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    return field.options ?? this.data.lookupOptions?.[field.key] ?? [];
  }

  optionLabel(_field: ConfigurableCrudField, option: ConfigurableCrudOption): string {
    return option.label;
  }

  async save(): Promise<void> {
    const payload = this.buildPayload();
    const missing = this.visibleFields().find((field) => {
      if (!this.isRequired(field)) return false;
      return !String(payload[field.payloadKey ?? field.key] ?? '').trim();
    });
    if (missing) {
      this.snack.warning(
        this.transloco.translate('Field is required.', {
          field: this.transloco.translate(missing.label),
        }),
      );
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.api.post(
        this.data.config.createEndpoint ?? this.data.config.endpoint,
        payload,
      );
      const option = this.data.optionFromResponse?.(response, payload) ?? null;
      this.dialogRef.close({ response, payload, option });
    } catch (error) {
      this.snack.error(
        this.errorMessage(error) || this.transloco.translate('Failed to save record.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  private buildPayload(): ConfigurableCrudRecord {
    const values = this.values();
    const payload: ConfigurableCrudRecord = {};
    for (const field of this.visibleFields()) {
      const key = field.payloadKey ?? field.key;
      payload[key] = values[field.key] ?? null;
    }
    return payload;
  }

  private isRequired(field: ConfigurableCrudField): boolean {
    return Boolean(
      field.required || field.requiredWhen?.({ editing: false, values: this.values() }),
    );
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    const value = error as {
      error?: { message?: string; error?: string };
      message?: string;
    } | null;
    return value?.error?.message ?? value?.error?.error ?? value?.message ?? '';
  }
}
