import { Pipe, PipeTransform } from '@angular/core';
import { signalFieldErrorKey } from './field-validation';

/** `{{ form.email().errors() | mnsFieldErrorKey | transloco }}` inside `<mat-error>`. */
@Pipe({ name: 'mnsFieldErrorKey', standalone: true })
export class FieldErrorKeyPipe implements PipeTransform {
  transform(errors: readonly { readonly kind: string }[] | null | undefined): string {
    return signalFieldErrorKey(errors);
  }
}
