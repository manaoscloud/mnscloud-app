import { Directive, DoCheck, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { FlagErrorStateMatcher } from './field-validation';

/**
 * `[mnsInvalid]="flag"` on a `matInput` or `mat-select` (Required Field Feedback Baseline).
 *
 * Forms in this App keep values in signals, so Material has no `NgControl` and never recomputes
 * the error state on its own. This installs a flag-driven matcher (a real control, when present,
 * still counts) and refreshes the state every check, so the field turns red and `<mat-error>`
 * shows while the flag is true.
 */
@Directive({
  selector: 'input[mnsInvalid], textarea[mnsInvalid], mat-select[mnsInvalid]',
  standalone: true,
})
export class FieldInvalidDirective implements DoCheck {
  readonly mnsInvalid = input<boolean | null | undefined>(false);

  private readonly control =
    inject(MatInput, { self: true, optional: true }) ??
    inject(MatSelect, { self: true, optional: true });
  private readonly ngControl = inject(NgControl, { self: true, optional: true });

  constructor() {
    if (this.control) {
      this.control.errorStateMatcher = new FlagErrorStateMatcher(() => !!this.mnsInvalid());
    }
  }

  ngDoCheck(): void {
    // With an NgControl, Material already refreshes the error state in its own ngDoCheck.
    if (!this.ngControl) this.control?.updateErrorState();
  }
}
