import { Component, input } from '@angular/core';
import { FormField, type Field } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

type SignalFormField = Field<any, string | number>;

@Component({
  selector: 'mns-textarea-field',
  standalone: true,
  imports: [FormField, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" [class]="fieldClass()">
      <mat-label>{{ label() }}</mat-label>
      <textarea
        matInput
        [rows]="rows()"
        [placeholder]="placeholder()"
        [formField]="field()"
      ></textarea>
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
export class MnsTextareaFieldComponent {
  readonly field = input.required<SignalFormField>();
  readonly label = input.required<string>();
  readonly rows = input(3);
  readonly placeholder = input('');
  readonly fieldClass = input('');
}
