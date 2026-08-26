import { Component, input } from '@angular/core';
import { type Field } from '@angular/forms/signals';
import {
  MnsSearchSelectFieldComponent,
  type MnsSearchSelectFieldOption,
} from '../mns-search-select-field/mns-search-select-field';

type SignalFormField = Field<any, any>;

export type MnsSelectFieldOption = {
  value: string | number | boolean;
  label: string;
};

@Component({
  selector: 'mns-select-field',
  standalone: true,
  imports: [MnsSearchSelectFieldComponent],
  template: `
    <mns-search-select-field
      [field]="field()"
      [label]="label()"
      [options]="searchOptions()"
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
export class MnsSelectFieldComponent {
  readonly field = input.required<SignalFormField>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly MnsSelectFieldOption[]>();
  readonly fieldClass = input('');
  readonly placeholder = input('Search');
  readonly emptyLabel = input('No records found.');

  searchOptions(): readonly MnsSearchSelectFieldOption[] {
    return this.options();
  }
}
