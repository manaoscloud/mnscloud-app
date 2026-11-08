import type { Provider } from '@angular/core';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  type MatFormFieldDefaultOptions,
} from '@angular/material/form-field';

/**
 * One field identity for every form: the label always sits on the outline, empty or filled,
 * for text inputs, text areas, dates and selects alike. Without it Material floats the label of
 * an empty text input inside the box (larger, like a placeholder) while select fields keep it on
 * the outline, so the same form showed two field styles.
 */
export const MNS_FORM_FIELD_DEFAULTS: MatFormFieldDefaultOptions = {
  floatLabel: 'always',
};

export const provideMnsFormFieldDefaults = (): Provider => ({
  provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
  useValue: MNS_FORM_FIELD_DEFAULTS,
});
