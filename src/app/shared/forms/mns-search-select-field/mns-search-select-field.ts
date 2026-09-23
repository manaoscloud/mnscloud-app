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
  /** Extra CSS class for the option row (group/subgroup headers). */
  optionClass?: string;
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
                (input)="setSearch($any($event.target).value)"
                (click)="$event.stopPropagation()"
                (keydown)="$event.stopPropagation()"
                autocomplete="off"
                [attr.aria-disabled]="false"
              />
            </mat-form-field>
          </mat-option>

          @if (loadError()) {
            <mat-option disabled>{{ 'Failed to load options.' | transloco }}</mat-option>
          }
          @if (remoteSearch()) {
            <div class="select-search-option" role="group">
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasPrevious() || loading()"
                [attr.aria-label]="'Previous page' | transloco"
                [matTooltip]="'Previous page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(-1)"
              >
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasNext() || loading()"
                [attr.aria-label]="'Next page' | transloco"
                [matTooltip]="'Next page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(1)"
              >
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
          @if (loading()) {
            <mat-option disabled class="select-state-option">
              {{ loadingLabel() | transloco }}
            </mat-option>
          }

          @for (option of filteredOptions(); track optionTrack(option)) {
            <mat-option
              [value]="option.value"
              [disabled]="option.disabled"
              [class]="option.optionClass ?? ''"
            >
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
          [disabled]="disabled()"
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
                (input)="setSearch($any($event.target).value)"
                (click)="$event.stopPropagation()"
                (keydown)="$event.stopPropagation()"
                autocomplete="off"
                [attr.aria-disabled]="false"
              />
            </mat-form-field>
          </mat-option>

          @if (loadError()) {
            <mat-option disabled>{{ 'Failed to load options.' | transloco }}</mat-option>
          }
          @if (remoteSearch()) {
            <div class="select-search-option" role="group">
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasPrevious() || loading()"
                [attr.aria-label]="'Previous page' | transloco"
                [matTooltip]="'Previous page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(-1)"
              >
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasNext() || loading()"
                [attr.aria-label]="'Next page' | transloco"
                [matTooltip]="'Next page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(1)"
              >
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
          @if (loading()) {
            <mat-option disabled class="select-state-option">
              {{ loadingLabel() | transloco }}
            </mat-option>
          }

          @for (option of filteredOptions(); track optionTrack(option)) {
            <mat-option
              [value]="option.value"
              [disabled]="option.disabled"
              [class]="option.optionClass ?? ''"
            >
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
  readonly disabled = input(false);
  readonly translateOptions = input(false);
  readonly multiple = input(false);
  readonly canCreate = input(false);
  readonly createLabel = input('Create new');
  readonly createRecord = output<void>();

  readonly remoteSearch = input(false);
  readonly hasPrevious = input(false);
  readonly hasNext = input(false);
  readonly loadError = input(false);
  readonly searchChange = output<string>();
  readonly pageChange = output<number>();
  readonly search = signal('');
  setSearch(value: string): void {
    this.search.set(value);
    this.searchChange.emit(value);
  }

  readonly selectedOption = computed(() => {
    const field = this.field();
    const currentValue = field ? field().value() : this.value();
    return this.options().find(
      (option) => !option.disabled && this.areOptionValuesEqual(option.value, currentValue),
    );
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
    const options = this.options();
    if (!term || this.remoteSearch()) return options;

    const matches = new Set<number>();
    options.forEach((option, index) => {
      if (option.disabled) return;
      if (this.normalize(this.optionSearchText(option)).includes(term)) {
        matches.add(index);
      }
    });
    if (!matches.size) return [];

    const visible = new Set<number>();
    for (const matchIndex of matches) {
      visible.add(matchIndex);
      for (let i = matchIndex - 1; i >= 0; i -= 1) {
        const option = options[i];
        if (!option?.disabled) break;
        visible.add(i);
        if ((option.optionClass ?? '').includes('select-group-option')) break;
      }
    }
    return options.filter((_, index) => visible.has(index));
  });

  handleOpenedChange(opened: boolean): void {
    this.openedChange.emit(opened);
    if (!opened) this.setSearch('');
  }

  readonly compareOptionValues = (left: unknown, right: unknown): boolean =>
    this.areOptionValuesEqual(left, right);

  optionTrack(option: MnsSearchSelectFieldOption): string {
    return `${String(option.value)}::${option.label}::${option.optionClass ?? ''}`;
  }

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
