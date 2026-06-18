import { Component, input } from '@angular/core';
import { FormField, type Field } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

type SignalFormField = Field<any, any>;

export type MnsSelectFieldOption = {
  value: string | number | boolean;
  label: string;
};

@Component({
  selector: 'mns-select-field',
  standalone: true,
  imports: [FormField, MatFormFieldModule, MatSelectModule, TranslocoPipe],
  template: `
    <mat-form-field appearance="outline" [class]="fieldClass()">
      <mat-label>{{ label() }}</mat-label>
      <mat-select [formField]="field()">
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value">{{ option.label | transloco }}</mat-option>
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
export class MnsSelectFieldComponent {
  readonly field = input.required<SignalFormField>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly MnsSelectFieldOption[]>();
  readonly fieldClass = input('');
}
