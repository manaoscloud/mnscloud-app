import { ElementRef, inject } from '@angular/core';
import { SnackbarService } from '../../services/snackbar.service';
import { revealInvalidFormFields } from './field-validation';

/**
 * Required Field Feedback Baseline for forms outside the generic CRUD (signal forms and dialogs).
 * Call in an injection context; the returned function marks the form touched so Material shows
 * the errors, then names the invalid fields in a toast and focuses the first one.
 *
 *   private readonly revealInvalid = injectRevealInvalidFields();
 *   if (!this.form().valid()) return this.revealInvalid(this.form());
 */
export function injectRevealInvalidFields(): (state?: { markAsTouched(): void }) => void {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const snack = inject(SnackbarService);
  return (state) => {
    state?.markAsTouched();
    revealInvalidFormFields(
      () => host.nativeElement,
      (key, params) => snack.warning(key, 5000, params),
    );
  };
}
