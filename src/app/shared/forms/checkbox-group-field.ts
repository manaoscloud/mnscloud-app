import { Component, computed, input, output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'mns-checkbox-group-field',
  imports: [MatCheckboxModule, TranslocoPipe],
  host: { '[class.is-invalid]': 'invalid()' },
  template: ` <fieldset [disabled]="disabled()" [attr.aria-invalid]="invalid() || null">
      <legend>{{ label() }}</legend>
      <mat-checkbox
        [disabled]="disabled()"
        [checked]="allSelected()"
        [indeterminate]="value().length > 0 && !allSelected()"
        (change)="valueChange.emit($event.checked ? options().map(optionValue) : [])"
      >
        {{ 'Select all' | transloco }}
      </mat-checkbox>
      <div class="options">
        @for (option of options(); track option.value) {
          <mat-checkbox
            [disabled]="disabled()"
            [checked]="value().includes(option.value)"
            (change)="toggle(option.value, $event.checked)"
            >{{ option.label }}</mat-checkbox
          >
        }
      </div>
    </fieldset>
    @if (invalid() && errorMessage()) {
      <div class="field-error" role="alert">{{ errorMessage() }}</div>
    }`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      fieldset {
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
        padding: 12px;
        margin: 0;
      }
      .options {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px 16px;
        border-top: 1px solid var(--mat-sys-outline-variant);
        margin-top: 8px;
        padding-top: 8px;
      }
      mat-checkbox {
        min-height: 44px;
      }
      :host(.is-invalid) fieldset {
        border-color: var(--mat-sys-color-error);
      }
      :host(.is-invalid) legend,
      .field-error {
        color: var(--mat-sys-color-error);
      }
      .field-error {
        font-size: 0.75rem;
        line-height: 1.25;
        padding: 4px 16px 0;
      }
      @media (max-width: 600px) {
        .options {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CheckboxGroupFieldComponent {
  readonly label = input('');
  readonly options = input<readonly { value: unknown; label: string }[]>([]);
  readonly value = input<readonly unknown[]>([]);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly errorMessage = input('');
  readonly valueChange = output<unknown[]>();
  readonly allSelected = computed(
    () => this.options().length > 0 && this.options().every((o) => this.value().includes(o.value)),
  );
  readonly optionValue = (option: { value: unknown }) => option.value;
  toggle(value: unknown, checked: boolean) {
    this.valueChange.emit(
      checked ? [...new Set([...this.value(), value])] : this.value().filter((v) => v !== value),
    );
  }
}
