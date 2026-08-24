import { Component, computed, input, output, signal } from '@angular/core';
import { FormField, type Field } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

type SignalFormField = Field<any, any>;

export type MnsSearchSelectFieldOption = {
  value: string | number | boolean | null;
  label: string;
  description?: string;
  searchText?: string;
  disabled?: boolean;
};

type MnsSearchSelectValue = string | number | boolean | null | readonly unknown[];

@Component({
  selector: 'mns-search-select-field',
  standalone: true,
  host: {
    '[class]': 'fieldClass()',
  },
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <mat-form-field appearance="outline" floatLabel="always" [class]="fieldClass()">
      <mat-label>{{ label() }}</mat-label>
      @if (field(); as formField) {
        <mat-select
          [formField]="formField"
          [multiple]="multiple()"
          [compareWith]="compareOptionValues"
          (selectionChange)="selectValue($event.value)"
          (openedChange)="handleOpenedChange($event)"
        >
          <mat-select-trigger>
            @if (multiple()) {
              {{ selectedOptionLabels() }}
            } @else if (selectedOption(); as option) {
              @if (translateOptions()) {
                {{ option.label | transloco }}
              } @else {
                {{ option.label }}
              }
            }
          </mat-select-trigger>

          <mat-option class="select-search-option" disabled>
            <mat-form-field appearance="outline" class="select-search-field">
              <mat-icon matPrefix>search</mat-icon>
              <input
                matInput
                [placeholder]="placeholder() | transloco"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
                (click)="$event.stopPropagation()"
                (keydown)="$event.stopPropagation()"
                autocomplete="off"
              />
            </mat-form-field>
          </mat-option>

          @if (loading()) {
            <mat-option disabled class="select-state-option">
              {{ loadingLabel() | transloco }}
            </mat-option>
          }

          @for (option of filteredOptions(); track option.value) {
            <mat-option [value]="option.value" [disabled]="option.disabled">
              <span class="select-option-main">
                @if (translateOptions()) {
                  {{ option.label | transloco }}
                } @else {
                  {{ option.label }}
                }
              </span>
              @if (option.description) {
                <span class="select-option-description">{{ option.description }}</span>
              }
            </mat-option>
          } @empty {
            @if (!loading()) {
              <mat-option disabled class="select-state-option">{{
                emptyLabel() | transloco
              }}</mat-option>
              @if (canCreate()) {
                <mat-option class="select-create-option" (click)="triggerCreate($event)">
                  <mat-icon>add</mat-icon>
                  <span>{{ createLabel() | transloco }}</span>
                </mat-option>
              }
            }
          }
        </mat-select>
      } @else {
        <mat-select
          [value]="value()"
          [multiple]="multiple()"
          [compareWith]="compareOptionValues"
          (selectionChange)="selectValue($event.value)"
          (openedChange)="handleOpenedChange($event)"
        >
          <mat-select-trigger>
            @if (multiple()) {
              {{ selectedOptionLabels() }}
            } @else if (selectedOption(); as option) {
              @if (translateOptions()) {
                {{ option.label | transloco }}
              } @else {
                {{ option.label }}
              }
            }
          </mat-select-trigger>

          <mat-option class="select-search-option" disabled>
            <mat-form-field appearance="outline" class="select-search-field">
              <mat-icon matPrefix>search</mat-icon>
              <input
                matInput
                [placeholder]="placeholder() | transloco"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
                (click)="$event.stopPropagation()"
                (keydown)="$event.stopPropagation()"
                autocomplete="off"
              />
            </mat-form-field>
          </mat-option>

          @if (loading()) {
            <mat-option disabled class="select-state-option">
              {{ loadingLabel() | transloco }}
            </mat-option>
          }

          @for (option of filteredOptions(); track option.value) {
            <mat-option [value]="option.value" [disabled]="option.disabled">
              <span class="select-option-main">
                @if (translateOptions()) {
                  {{ option.label | transloco }}
                } @else {
                  {{ option.label }}
                }
              </span>
              @if (option.description) {
                <span class="select-option-description">{{ option.description }}</span>
              }
            </mat-option>
          } @empty {
            @if (!loading()) {
              <mat-option disabled class="select-state-option">{{
                emptyLabel() | transloco
              }}</mat-option>
              @if (canCreate()) {
                <mat-option class="select-create-option" (click)="triggerCreate($event)">
                  <mat-icon>add</mat-icon>
                  <span>{{ createLabel() | transloco }}</span>
                </mat-option>
              }
            }
          }
        </mat-select>
      }
      @if (canCreate()) {
        <button
          mat-icon-button
          matSuffix
          type="button"
          class="select-create-button"
          [attr.aria-label]="createLabel() | transloco"
          [matTooltip]="createLabel() | transloco"
          (click)="triggerCreate($event)"
        >
          <mat-icon>add</mat-icon>
        </button>
      }
    </mat-form-field>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      mat-form-field {
        width: 100%;
      }

      .select-create-button {
        --mdc-icon-button-state-layer-size: 36px;
        color: var(--mns-color-accent, #00d5d5);
        margin-right: -0.35rem;
      }

      .select-create-option {
        color: var(--mns-color-accent, #00d5d5);
      }

      .select-create-option mat-icon {
        margin-right: 0.5rem;
        vertical-align: middle;
      }
    `,
  ],
})
export class MnsSearchSelectFieldComponent {
  readonly field = input<SignalFormField | null>(null);
  readonly value = input<MnsSearchSelectValue>('');
  readonly valueChange = output<MnsSearchSelectValue>();
  readonly selectionChange = output<MnsSearchSelectValue>();
  readonly openedChange = output<boolean>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly MnsSearchSelectFieldOption[]>();
  readonly fieldClass = input('');
  readonly placeholder = input('Search');
  readonly emptyLabel = input('No records found.');
  readonly loadingLabel = input('Loading...');
  readonly loading = input(false);
  readonly translateOptions = input(false);
  readonly multiple = input(false);
  readonly canCreate = input(false);
  readonly createLabel = input('Create new');
  readonly createRecord = output<void>();

  readonly search = signal('');
  readonly selectedOption = computed(() => {
    const field = this.field();
    const currentValue = field ? field().value() : this.value();
    return this.options().find((option) => this.areOptionValuesEqual(option.value, currentValue));
  });
  readonly selectedOptionLabels = computed(() => {
    const field = this.field();
    const value = field ? field().value() : this.value();
    const selectedValues = Array.isArray(value) ? value : [];
    return selectedValues
      .map((selected) =>
        this.options().find((option) => this.areOptionValuesEqual(option.value, selected)),
      )
      .filter((option): option is MnsSearchSelectFieldOption => option !== undefined)
      .map((option) => option.label)
      .join(', ');
  });

  readonly filteredOptions = computed(() => {
    const term = this.normalize(this.search());
    if (!term) return this.options();
    return this.options().filter((option) =>
      this.normalize(this.optionSearchText(option)).includes(term),
    );
  });

  handleOpenedChange(opened: boolean): void {
    this.openedChange.emit(opened);
    if (!opened) this.search.set('');
  }

  readonly compareOptionValues = (left: unknown, right: unknown): boolean =>
    this.areOptionValuesEqual(left, right);

  selectValue(value: MnsSearchSelectValue): void {
    const nextValue = this.multiple() ? this.orderMultipleValues(value) : value;
    this.valueChange.emit(nextValue);
    this.selectionChange.emit(nextValue);
  }

  triggerCreate(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.createRecord.emit();
  }

  private orderMultipleValues(value: MnsSearchSelectValue): MnsSearchSelectValue {
    const selectedValues = Array.isArray(value) ? [...value] : [];
    const field = this.field();
    const currentValue = field ? field().value() : this.value();
    const currentValues = Array.isArray(currentValue) ? currentValue : [];
    return [
      ...currentValues.filter((current) =>
        selectedValues.some((selected) => this.areOptionValuesEqual(current, selected)),
      ),
      ...selectedValues.filter(
        (selected) =>
          !currentValues.some((current) => this.areOptionValuesEqual(current, selected)),
      ),
    ];
  }

  private optionSearchText(option: MnsSearchSelectFieldOption): string {
    return `${option.label} ${option.description ?? ''} ${option.searchText ?? ''} ${String(
      option.value,
    )}`;
  }

  private areOptionValuesEqual(left: unknown, right: unknown): boolean {
    return String(left ?? '') === String(right ?? '');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }
}
