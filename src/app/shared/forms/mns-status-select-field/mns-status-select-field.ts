import { Component, input } from '@angular/core';
import { type Field } from '@angular/forms/signals';
import {
  MnsSearchSelectFieldComponent,
  type MnsSearchSelectFieldOption,
} from '../mns-search-select-field/mns-search-select-field';

type SignalFormField = Field<any, string | number>;

@Component({
  selector: 'mns-status-select-field',
  standalone: true,
  imports: [MnsSearchSelectFieldComponent],
  template: `
    <mns-search-select-field
      [field]="field()"
      [label]="label()"
      [options]="options()"
      [fieldClass]="fieldClass()"
      [placeholder]="placeholder()"
      [emptyLabel]="emptyLabel()"
      [translateOptions]="true"
    />
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
  readonly fieldClass = input('');
  readonly placeholder = input('Search');
  readonly emptyLabel = input('No records found.');

  options(): readonly MnsSearchSelectFieldOption[] {
    return [
      { value: this.activeValue(), label: this.activeLabel() },
      { value: this.inactiveValue(), label: this.inactiveLabel() },
    ];
  }
}
