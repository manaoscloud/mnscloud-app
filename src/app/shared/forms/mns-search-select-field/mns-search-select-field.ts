import { Component, computed, input, signal } from '@angular/core';
import { FormField, type Field } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

type SignalFormField = Field<any, any>;

export type MnsSearchSelectFieldOption = {
  value: string | number | boolean | null;
  label: string;
  description?: string;
  searchText?: string;
  disabled?: boolean;
};

@Component({
  selector: 'mns-search-select-field',
  standalone: true,
  imports: [
    FormField,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  template: `
    <mat-form-field appearance="outline" floatLabel="always" [class]="fieldClass()">
      <mat-label>{{ label() }}</mat-label>
      <mat-select
        [formField]="field()"
        [compareWith]="compareOptionValues"
        (openedChange)="handleOpenedChange($event)"
      >
        <mat-select-trigger>
          @if (selectedOption(); as option) {
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
            <mat-option disabled class="select-state-option">{{ emptyLabel() | transloco }}</mat-option>
          }
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class MnsSearchSelectFieldComponent {
  readonly field = input.required<SignalFormField>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly MnsSearchSelectFieldOption[]>();
  readonly fieldClass = input('');
  readonly placeholder = input('Search');
  readonly emptyLabel = input('No records found.');
  readonly loadingLabel = input('Loading...');
  readonly loading = input(false);
  readonly translateOptions = input(false);

  readonly search = signal('');
  readonly selectedOption = computed(() => {
    const currentValue = this.field()().value();
    return this.options().find((option) => this.areOptionValuesEqual(option.value, currentValue));
  });

  readonly filteredOptions = computed(() => {
    const term = this.normalize(this.search());
    if (!term) return this.options();
    return this.options().filter((option) =>
      this.normalize(this.optionSearchText(option)).includes(term),
    );
  });

  handleOpenedChange(opened: boolean): void {
    if (!opened) this.search.set('');
  }

  readonly compareOptionValues = (left: unknown, right: unknown): boolean =>
    this.areOptionValuesEqual(left, right);

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
