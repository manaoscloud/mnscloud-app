import { Component, input } from '@angular/core';
import { FormField, type Field } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

type SignalFormField = Field<any, string | number>;

@Component({
  selector: 'mns-text-field',
  standalone: true,
  imports: [FormField, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ label() }}</mat-label>
      <input
        matInput
        [type]="type()"
        [autocomplete]="autocomplete()"
        [placeholder]="placeholder()"
        [formField]="field()"
      />
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
export class MnsTextFieldComponent {
  readonly field = input.required<SignalFormField>();
  readonly label = input.required<string>();
  readonly type = input('text');
  readonly autocomplete = input('');
  readonly placeholder = input('');
}
