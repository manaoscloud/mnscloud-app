import { Component, input } from '@angular/core';
import { FormField, type Field } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

type SignalFormField = Field<any, string | number>;

@Component({
  selector: 'mns-status-select-field',
  standalone: true,
  imports: [FormField, MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ label() }}</mat-label>
      <mat-select [formField]="field()">
        <mat-option [value]="activeValue()">{{ activeLabel() }}</mat-option>
        <mat-option [value]="inactiveValue()">{{ inactiveLabel() }}</mat-option>
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
export class MnsStatusSelectFieldComponent {
  readonly field = input.required<SignalFormField>();
  readonly label = input('Status');
  readonly activeValue = input<number | string>(1);
  readonly inactiveValue = input<number | string>(0);
  readonly activeLabel = input('Active');
  readonly inactiveLabel = input('Inactive');
}
