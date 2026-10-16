import { signal } from '@angular/core';
import { FormGroupDirective, NgForm, type AbstractControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

/**
 * Shared required-field feedback (`app.md` → Required Field Feedback Baseline).
 *
 * Forms in this App keep their values in signals, so Material never sees an invalid
 * `NgControl`. These helpers let any form mark a field invalid after a save attempt:
 * red outline + `<mat-error>` through `[mnsInvalid]` (FieldInvalidDirective), a toast naming
 * the field, and focus on the first invalid field (switching tabs when needed).
 */

/** Why a field was rejected. `custom` carries a page-specific message. */
export type FieldErrorKind = 'required' | 'invalidDate' | 'invalidJson' | 'custom';

export interface FieldError {
  readonly kind: FieldErrorKind;
  /** Translation key shown under the field (`<mat-error>`). */
  readonly message: string;
  readonly params?: Record<string, string | number>;
}

/** Translation keys for the inline message of each built-in kind. */
export const FIELD_ERROR_MESSAGES: Record<Exclude<FieldErrorKind, 'custom'>, string> = {
  required: 'form.validation.required',
  invalidDate: 'form.validation.invalidDate',
  invalidJson: 'form.validation.invalidJson',
};

export function fieldError(
  kind: Exclude<FieldErrorKind, 'custom'>,
  params?: Record<string, string | number>,
): FieldError {
  return { kind, message: FIELD_ERROR_MESSAGES[kind], params };
}

export function customFieldError(
  message: string,
  params?: Record<string, string | number>,
): FieldError {
  return { kind: 'custom', message, params };
}

/** Empty as far as "required" goes: null, undefined, blank text or an empty list. */
export function isBlankFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Error state driven by a flag instead of an `NgControl`. Material calls the matcher even
 * without a control, so `matInput`/`mat-select` turn red and show `<mat-error>`. When a real
 * control exists (signal forms interop), its own invalid+touched state still counts.
 */
export class FlagErrorStateMatcher implements ErrorStateMatcher {
  private readonly fallback = new ErrorStateMatcher();

  constructor(private readonly flag: () => boolean) {}

  isErrorState(control: AbstractControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return this.flag() || this.fallback.isErrorState(control, form);
  }
}

/** The SAVE toast: names the first missing field and how many others are missing. */
export function missingFieldsToast(labels: readonly string[]): {
  key: string;
  params: Record<string, string | number>;
} {
  const [first = '', ...others] = labels;
  return others.length
    ? { key: 'form.validation.missingMany', params: { field: first, count: others.length } }
    : { key: 'form.validation.missingOne', params: { field: first } };
}

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), ' +
  '[role="combobox"]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"]), button:not([disabled])';

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

/** The element to focus for a `[data-field-key]` marker (the control itself or its inner one). */
export function fieldFocusTarget(root: ParentNode, key: string): HTMLElement | null {
  const marker = root.querySelector<HTMLElement>(`[data-field-key="${cssEscape(key)}"]`);
  if (!marker) return null;
  if (marker.matches(FOCUSABLE)) return marker;
  return marker.querySelector<HTMLElement>(FOCUSABLE) ?? marker;
}

function focusKey(roots: readonly ParentNode[], key: string): boolean {
  for (const root of roots) {
    const target = fieldFocusTarget(root, key);
    if (!target) continue;
    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
    return true;
  }
  return false;
}

/**
 * Scrolls the first invalid field into view and focuses it. Tab bodies render after the tab
 * switch, so it waits a few frames for the first key before falling back to the others (a
 * field the page renders without a `data-field-key` marker).
 */
export function focusFirstInvalidField(
  roots: () => readonly ParentNode[],
  keys: readonly string[],
  attempts = 20,
): void {
  if (!keys.length) return;
  const tryFocus = (left: number) => {
    if (focusKey(roots(), keys[0])) return;
    if (left > 0) {
      requestAnimationFrame(() => tryFocus(left - 1));
      return;
    }
    for (const key of keys.slice(1)) if (focusKey(roots(), key)) return;
  };
  requestAnimationFrame(() => tryFocus(attempts));
}

/** The CHECK toast for forms validated by Material controls (wording fits any error kind). */
export function invalidFieldsToast(labels: readonly string[]): {
  key: string;
  params: Record<string, string | number>;
} {
  const [first = '', ...others] = labels;
  return others.length
    ? { key: 'form.validation.checkMany', params: { field: first, count: others.length } }
    : { key: 'form.validation.checkOne', params: { field: first } };
}

const INVALID_CONTROL =
  '.mat-mdc-form-field.mat-form-field-invalid, [aria-invalid="true"]:not(.mat-mdc-form-field *)';

function controlLabel(element: Element): string {
  const label =
    element.querySelector('mat-label, legend, .permission-tree-label')?.textContent ??
    element.getAttribute('aria-label') ??
    '';
  return label.replace(/\s*\*\s*$/, '').trim();
}

/**
 * Forms whose controls carry their own validity (signal forms, `[invalid]` inputs): call after
 * marking the fields touched. Waits for Material to flag the invalid controls, names them in one
 * toast and focuses the first. Returns nothing: the caller already knows the form is invalid.
 */
export function revealInvalidFormFields(
  root: () => ParentNode | null | undefined,
  notify: (key: string, params: Record<string, string | number>) => void,
  attempts = 10,
): void {
  const tryReveal = (left: number) => {
    const container = root();
    const invalid = container ? [...container.querySelectorAll(INVALID_CONTROL)] : [];
    if (!invalid.length) {
      if (left > 0) requestAnimationFrame(() => tryReveal(left - 1));
      return;
    }
    const labels = invalid.map(controlLabel).filter(Boolean);
    const toast = invalidFieldsToast(labels.length ? labels : ['']);
    notify(toast.key, toast.params);
    const first = invalid[0] as HTMLElement;
    const target = first.matches(FOCUSABLE)
      ? first
      : (first.querySelector<HTMLElement>(FOCUSABLE) ?? first);
    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
  };
  requestAnimationFrame(() => tryReveal(attempts));
}

/** Translation key for the first error of a signal-forms field (`<mat-error>` text). */
export function signalFieldErrorKey(
  errors: readonly { readonly kind: string }[] | null | undefined,
): string {
  const kind = errors?.[0]?.kind;
  switch (kind) {
    case undefined:
      return '';
    case 'required':
      return FIELD_ERROR_MESSAGES.required;
    case 'email':
      return 'form.validation.email';
    case 'minLength':
      return 'form.validation.minLength';
    case 'maxLength':
      return 'form.validation.maxLength';
    default:
      return 'form.validation.invalid';
  }
}

/**
 * Plain signal dialogs (one signal per field): declare when each field is valid, bind
 * `[mnsInvalid]="rules.invalid('x')"` + `<mat-error>` in the template and call `check()` on
 * save. Errors appear only after the first attempt.
 */
export class FieldRules<K extends string> {
  private readonly attempted = signal(false);

  constructor(private readonly rules: Readonly<Record<K, () => boolean>>) {}

  invalid(key: K): boolean {
    return this.attempted() && !this.rules[key]();
  }

  /** Marks the save attempt; true when every field is valid. */
  check(): boolean {
    this.attempted.set(true);
    return (Object.keys(this.rules) as K[]).every((key) => this.rules[key]());
  }

  reset(): void {
    this.attempted.set(false);
  }
}
